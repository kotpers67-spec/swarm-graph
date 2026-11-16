use regex::Regex;
use serde_json::Value;
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::sync::{Arc, OnceLock};
use tokio::sync::RwLock;

#[derive(Clone)]
pub struct TranslatorService {
    cache: Arc<RwLock<HashMap<String, String>>>,
    cache_path: PathBuf,
    client: reqwest::Client,
}

fn cache_file_path() -> PathBuf {
    let base = dirs::data_local_dir().unwrap_or_else(std::env::temp_dir);
    base.join("SwarmGraph").join("translations-ru.json")
}

fn token_mask_regex() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| {
        Regex::new(
            r#"(?s)```.*?```|`[^`\n]+`|https?://[^\s)\]>]+|</?[a-zA-Z0-9_:-]+(?:\s+[^>]*)?>|[A-Za-z]:[/\\][^\s"'`<>]+|@[a-zA-Z0-9_#-]+|\B#\d+\b"#,
        )
        .expect("valid mask regex")
    })
}

pub fn needs_translation_to_ru(text: &str) -> bool {
    let mut latin = 0usize;
    let mut cyrillic = 0usize;
    for ch in text.chars() {
        if ch.is_ascii_alphabetic() {
            latin += 1;
        } else if ('\u{0400}'..='\u{04FF}').contains(&ch) {
            cyrillic += 1;
        }
    }
    (latin >= 4 && cyrillic == 0) || (latin >= 6 && latin >= cyrillic)
}

pub fn mask_technical_tokens(text: &str) -> (String, Vec<String>) {
    let mut tokens = Vec::new();
    let mut out = String::with_capacity(text.len());
    let mut last = 0;

    for m in token_mask_regex().find_iter(text) {
        out.push_str(&text[last..m.start()]);
        let idx = tokens.len();
        tokens.push(m.as_str().to_string());
        out.push_str(&format!("[[M{idx}]]"));
        last = m.end();
    }
    out.push_str(&text[last..]);
    (out, tokens)
}

pub fn unmask_technical_tokens(translated: &str, tokens: &[String]) -> String {
    static RE: OnceLock<Regex> = OnceLock::new();
    let re = RE.get_or_init(|| {
        Regex::new(r"\[\s*\[\s*[Mm]\s*(\d+)\s*\]\s*\]").expect("valid unmask regex")
    });
    re.replace_all(translated, |caps: &regex::Captures| {
        if let Ok(idx) = caps[1].parse::<usize>() {
            if let Some(tok) = tokens.get(idx) {
                return tok.clone();
            }
        }
        caps[0].to_string()
    })
    .to_string()
}

pub fn parse_gtx_response(json: &Value) -> Option<String> {
    if let Some(sentences) = json.get(0).and_then(|v| v.as_array()) {
        let mut translated = String::new();
        for s in sentences {
            if let Some(part) = s.get(0).and_then(|v| v.as_str()) {
                translated.push_str(part);
            }
        }
        if !translated.is_empty() {
            return Some(translated);
        }
    }
    None
}

pub fn parse_clients5_response(json: &Value) -> Option<String> {
    if let Some(arr) = json.as_array() {
        let mut translated = String::new();
        for item in arr {
            if let Some(s) = item.as_str() {
                translated.push_str(s);
            } else if let Some(inner) = item.as_array() {
                if let Some(s) = inner.get(0).and_then(|v| v.as_str()) {
                    translated.push_str(s);
                }
            }
        }
        if !translated.is_empty() {
            return Some(translated);
        }
    } else if let Some(s) = json.as_str() {
        if !s.is_empty() {
            return Some(s.to_string());
        }
    }
    None
}

fn split_chunks(text: &str, max_len: usize) -> Vec<String> {
    if text.len() <= max_len {
        return vec![text.to_string()];
    }
    let mut chunks = Vec::new();
    let mut current = String::new();
    for line in text.split_inclusive('\n') {
        if current.len() + line.len() > max_len && !current.is_empty() {
            chunks.push(current);
            current = String::new();
        }
        if line.len() > max_len {
            for ch in line.chars() {
                if current.len() + ch.len_utf8() > max_len {
                    chunks.push(current);
                    current = String::new();
                }
                current.push(ch);
            }
        } else {
            current.push_str(line);
        }
    }
    if !current.is_empty() {
        chunks.push(current);
    }
    chunks
}

impl TranslatorService {
    pub fn new() -> Self {
        let path = cache_file_path();
        let loaded = fs::read_to_string(&path)
            .ok()
            .and_then(|s| serde_json::from_str::<HashMap<String, String>>(&s).ok())
            .unwrap_or_default();

        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(10))
            .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36")
            .build()
            .unwrap_or_else(|_| reqwest::Client::new());

        Self {
            cache: Arc::new(RwLock::new(loaded)),
            cache_path: path,
            client,
        }
    }

    async fn persist_cache(&self) {
        let snapshot = self.cache.read().await.clone();
        if let Some(parent) = self.cache_path.parent() {
            let _ = tokio::fs::create_dir_all(parent).await;
        }
        if let Ok(json) = serde_json::to_string(&snapshot) {
            let _ = tokio::fs::write(&self.cache_path, json).await;
        }
    }

    async fn translate_chunk(&self, chunk: &str) -> Result<String, String> {
        let primary_res = self
            .client
            .get("https://translate.googleapis.com/translate_a/single")
            .query(&[
                ("client", "gtx"),
                ("sl", "auto"),
                ("tl", "ru"),
                ("dt", "t"),
                ("q", chunk),
            ])
            .send()
            .await;

        if let Ok(resp) = primary_res {
            if resp.status().is_success() {
                if let Ok(json) = resp.json::<Value>().await {
                    if let Some(translated) = parse_gtx_response(&json) {
                        return Ok(translated);
                    }
                }
            }
        }

        let fallback_res = self
            .client
            .get("https://clients5.google.com/translate_a/t")
            .query(&[
                ("client", "dict-chrome-ex"),
                ("sl", "auto"),
                ("tl", "ru"),
                ("q", chunk),
            ])
            .send()
            .await;

        if let Ok(resp) = fallback_res {
            if resp.status().is_success() {
                if let Ok(json) = resp.json::<Value>().await {
                    if let Some(translated) = parse_clients5_response(&json) {
                        return Ok(translated);
                    }
                }
            }
        }

        Err("Не удалось перевести фрагмент через доступные эндпоинты".to_string())
    }

    pub async fn translate_one(&self, text: &str) -> String {
        let trimmed = text.trim();
        if trimmed.is_empty() || !needs_translation_to_ru(trimmed) {
            return text.to_string();
        }

        if let Some(cached) = self.cache.read().await.get(trimmed).cloned() {
            return cached;
        }

        let (masked, tokens) = mask_technical_tokens(trimmed);
        let chunks = split_chunks(&masked, 1300);
        let mut translated_masked = String::new();

        for chunk in chunks {
            match self.translate_chunk(&chunk).await {
                Ok(part) => translated_masked.push_str(&part),
                Err(_) => return text.to_string(),
            }
        }

        let final_text = unmask_technical_tokens(&translated_masked, &tokens);
        {
            let mut guard = self.cache.write().await;
            guard.insert(trimmed.to_string(), final_text.clone());
        }
        self.persist_cache().await;
        final_text
    }

    pub async fn translate_batch(&self, texts: Vec<String>) -> HashMap<String, String> {
        let mut unique = Vec::new();
        let mut seen = std::collections::HashSet::new();
        for text in texts {
            let trimmed = text.trim().to_string();
            if !trimmed.is_empty() && seen.insert(trimmed.clone()) {
                unique.push(trimmed);
            }
        }

        let mut out = HashMap::new();
        let mut set = tokio::task::JoinSet::new();
        let sem = Arc::new(tokio::sync::Semaphore::new(6));

        for text in unique {
            let svc = self.clone();
            let permit_sem = sem.clone();
            set.spawn(async move {
                let _permit = permit_sem.acquire().await.ok();
                let ru = svc.translate_one(&text).await;
                (text, ru)
            });
        }

        while let Some(res) = set.join_next().await {
            if let Ok((orig, ru)) = res {
                out.insert(orig, ru);
            }
        }
        out
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn detects_english_vs_russian() {
        assert!(needs_translation_to_ru(
            "You own src/parser.rs. Make the three failing cases pass."
        ));
        assert!(!needs_translation_to_ru(
            "Проверь конфиг Bexum Connect и отправь отчёт @verifier"
        ));
    }

    #[test]
    fn masks_and_restores_technical_tokens() {
        let src = "@verifier check #4 in `src/lib.rs` and C:\\Users\\kotpe\\test.json";
        let (masked, tokens) = mask_technical_tokens(src);
        assert!(masked.contains("[[M0]]"));
        assert!(masked.contains("[[M1]]"));
        assert!(masked.contains("[[M2]]"));
        assert!(masked.contains("[[M3]]"));
        let restored = unmask_technical_tokens(&masked, &tokens);
        assert_eq!(restored, src);
    }
}
