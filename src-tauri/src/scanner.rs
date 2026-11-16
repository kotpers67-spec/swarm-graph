use crate::models::{
    BoardMessage, SessionDetail, SessionSummary, SubagentNode, SwarmMember, SwarmMeta,
    ToolAction, TranscriptStep,
};
use regex::Regex;
use serde_json::Value;
use std::collections::{BTreeSet, HashMap};
use std::fs::{self, File};
use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};
use std::sync::OnceLock;
use std::time::{SystemTime, UNIX_EPOCH};

pub fn default_brain_dir() -> PathBuf {
    if let Some(home) = dirs::home_dir() {
        return home.join(".gemini").join("antigravity").join("brain");
    }
    PathBuf::from(r"C:\Users\kotpe\.gemini\antigravity\brain")
}

fn mention_regex() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| Regex::new(r"@([a-zA-Z0-9_#-]+)").expect("valid mention regex"))
}

fn seq_ref_regex() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| Regex::new(r"(?:^|[^\w])#(\d+)").expect("valid seq regex"))
}

pub fn extract_mentions(text: &str) -> Vec<String> {
    let mut seen = BTreeSet::new();
    for cap in mention_regex().captures_iter(text) {
        if let Some(m) = cap.get(1) {
            seen.insert(m.as_str().to_string());
        }
    }
    seen.into_iter().collect()
}

pub fn extract_seq_refs(text: &str) -> Vec<u64> {
    let mut seen = BTreeSet::new();
    for cap in seq_ref_regex().captures_iter(text) {
        if let Some(m) = cap.get(1) {
            if let Ok(num) = m.as_str().parse::<u64>() {
                seen.insert(num);
            }
        }
    }
    seen.into_iter().collect()
}

fn modified_ms(path: &Path) -> u64 {
    fs::metadata(path)
        .and_then(|m| m.modified())
        .ok()
        .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

pub fn parse_swarm_meta(path: &Path) -> Option<SwarmMeta> {
    let content = fs::read_to_string(path).ok()?;
    let val: Value = serde_json::from_str(&content).ok()?;
    Some(SwarmMeta {
        version: val.get("version").and_then(|v| v.as_u64()).unwrap_or(1) as u32,
        backend: val
            .get("backend")
            .and_then(|v| v.as_str())
            .unwrap_or("local")
            .to_string(),
        swarm_id: val
            .get("swarm_id")
            .and_then(|v| v.as_str())
            .unwrap_or_default()
            .to_string(),
        created_at: val
            .get("created_at")
            .and_then(|v| v.as_str())
            .unwrap_or_default()
            .to_string(),
    })
}

pub fn parse_members(path: &Path) -> (String, Vec<SwarmMember>) {
    let Ok(content) = fs::read_to_string(path) else {
        return (String::new(), Vec::new());
    };
    let Ok(val) = serde_json::from_str::<Value>(&content) else {
        return (String::new(), Vec::new());
    };

    let title = val
        .get("title")
        .and_then(|v| v.as_str())
        .unwrap_or_default()
        .to_string();

    let mut members = Vec::new();
    if let Some(obj) = val.get("members").and_then(|v| v.as_object()) {
        for (name, m) in obj {
            let channels = m
                .get("channels")
                .and_then(|c| c.as_array())
                .map(|arr| {
                    arr.iter()
                        .filter_map(|x| x.as_str().map(str::to_string))
                        .collect::<Vec<_>>()
                })
                .unwrap_or_else(|| vec!["main".to_string()]);

            members.push(SwarmMember {
                name: name.clone(),
                conversation_id: m
                    .get("conversation_id")
                    .and_then(|v| v.as_str())
                    .unwrap_or_default()
                    .to_string(),
                role: m
                    .get("role")
                    .and_then(|v| v.as_str())
                    .unwrap_or("worker")
                    .to_string(),
                phase: m
                    .get("phase")
                    .and_then(|v| v.as_str())
                    .unwrap_or_default()
                    .to_string(),
                desired_state: m
                    .get("desired_state")
                    .and_then(|v| v.as_str())
                    .unwrap_or_default()
                    .to_string(),
                desired_model: m
                    .get("desired_model")
                    .and_then(|v| v.as_str())
                    .unwrap_or_default()
                    .to_string(),
                applied_model: m
                    .get("applied_model")
                    .and_then(|v| v.as_str())
                    .unwrap_or_default()
                    .to_string(),
                model: m
                    .get("model")
                    .and_then(|v| v.as_str())
                    .unwrap_or_default()
                    .to_string(),
                workspace_mode: m
                    .get("workspace_mode")
                    .and_then(|v| v.as_str())
                    .unwrap_or("inherit")
                    .to_string(),
                wake_mode: m
                    .get("wake_mode")
                    .and_then(|v| v.as_str())
                    .unwrap_or("mentions")
                    .to_string(),
                wait_since: m.get("wait_since").and_then(|v| v.as_u64()).unwrap_or(0),
                last_read_seq: m.get("last_read_seq").and_then(|v| v.as_u64()).unwrap_or(0),
                killed: m.get("killed").and_then(|v| v.as_bool()).unwrap_or(false),
                channels,
            });
        }
    }

    members.sort_by(|a, b| {
        let rank = |role: &str, name: &str| match (role, name) {
            ("coordinator", _) => 0,
            (_, "verifier") => 1,
            (_, "monitor") => 3,
            (_, "narrator") => 4,
            _ => 2,
        };
        rank(&a.role, &a.name)
            .cmp(&rank(&b.role, &b.name))
            .then_with(|| a.name.cmp(&b.name))
    });

    (title, members)
}

pub fn parse_board(path: &Path) -> Vec<BoardMessage> {
    let Ok(file) = File::open(path) else {
        return Vec::new();
    };
    let reader = BufReader::new(file);
    let mut messages = Vec::new();

    for line in reader.lines().map_while(Result::ok) {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }
        let Ok(val) = serde_json::from_str::<Value>(trimmed) else {
            continue;
        };
        let text = val
            .get("text")
            .and_then(|v| v.as_str())
            .unwrap_or_default()
            .to_string();
        let mentions = extract_mentions(&text);
        let seq_refs = extract_seq_refs(&text);

        messages.push(BoardMessage {
            seq: val.get("seq").and_then(|v| v.as_u64()).unwrap_or(0),
            agent: val
                .get("agent")
                .and_then(|v| v.as_str())
                .unwrap_or("unknown")
                .to_string(),
            text,
            time: val
                .get("time")
                .and_then(|v| v.as_str())
                .unwrap_or_default()
                .to_string(),
            kind: val
                .get("kind")
                .and_then(|v| v.as_str())
                .unwrap_or("post")
                .to_string(),
            request_id: val
                .get("request_id")
                .and_then(|v| v.as_str())
                .unwrap_or_default()
                .to_string(),
            channel: val
                .get("channel")
                .and_then(|v| v.as_str())
                .unwrap_or("main")
                .to_string(),
            mentions,
            seq_refs,
        });
    }

    messages.sort_by_key(|m| m.seq);
    messages
}

pub fn parse_subagents_dir(dir: &Path, parent_id: &str) -> Vec<SubagentNode> {
    let Ok(entries) = fs::read_dir(dir) else {
        return Vec::new();
    };
    let mut nodes = Vec::new();
    for entry in entries.flatten() {
        let p = entry.path();
        if p.extension().and_then(|e| e.to_str()) != Some("json") {
            continue;
        }
        let Ok(content) = fs::read_to_string(&p) else {
            continue;
        };
        let Ok(val) = serde_json::from_str::<Value>(&content) else {
            continue;
        };
        let descriptor = val.get("subagentDescriptor");
        nodes.push(SubagentNode {
            conversation_id: val
                .get("conversationId")
                .and_then(|v| v.as_str())
                .unwrap_or_default()
                .to_string(),
            type_name: descriptor
                .and_then(|d| d.get("typeName"))
                .and_then(|v| v.as_str())
                .unwrap_or("subagent")
                .to_string(),
            role: descriptor
                .and_then(|d| d.get("role"))
                .and_then(|v| v.as_str())
                .unwrap_or("Subagent")
                .to_string(),
            state: val
                .get("state")
                .and_then(|v| v.as_str())
                .unwrap_or("UNKNOWN")
                .to_string(),
            spawn_step_index: val
                .get("spawnStepIndex")
                .and_then(|v| v.as_u64())
                .unwrap_or(0),
            parent_conversation_id: parent_id.to_string(),
        });
    }
    nodes.sort_by_key(|n| n.spawn_step_index);
    nodes
}

fn truncate_chars(s: &str, max_chars: usize) -> String {
    let mut out = String::new();
    for (idx, ch) in s.chars().enumerate() {
        if idx >= max_chars {
            out.push('…');
            break;
        }
        out.push(ch);
    }
    out
}

fn clean_path_string(raw: &str) -> String {
    let unquoted = raw.trim().trim_matches('"').trim_matches('\'').trim();
    unquoted.replace("\\\\", "\\")
}

fn extract_filename_and_ext(path_str: &str) -> (Option<String>, Option<String>) {
    let clean = clean_path_string(path_str);
    if clean.is_empty() {
        return (None, None);
    }
    let p = Path::new(&clean);
    let fname = p.file_name().and_then(|f| f.to_str()).map(str::to_string);
    let ext = p
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_uppercase());
    (fname, ext)
}

fn parse_tool_actions(val: &Value, step_type: &str, cleaned_content: &str) -> Vec<ToolAction> {
    let mut actions = Vec::new();

    if let Some(tool_calls) = val.get("tool_calls").and_then(|v| v.as_array()) {
        for t in tool_calls {
            let name = t
                .get("name")
                .or_else(|| t.get("function").and_then(|f| f.get("name")))
                .and_then(|n| n.as_str())
                .unwrap_or_default();

            let args = t
                .get("args")
                .or_else(|| t.get("function").and_then(|f| f.get("arguments")));

            match name {
                "write_file" => {
                    let path_raw = args
                        .and_then(|a| a.get("Path"))
                        .and_then(|p| p.as_str())
                        .unwrap_or_default();
                    let (file_name, file_ext) = extract_filename_and_ext(path_raw);
                    let content_raw = args
                        .and_then(|a| a.get("Content"))
                        .and_then(|c| c.as_str())
                        .unwrap_or_default();
                    let lines = content_raw.lines().count().max(1);
                    let diff_stats = format!("+{lines} -0");
                    let fname_display = file_name.clone().unwrap_or_else(|| "файл".to_string());
                    actions.push(ToolAction {
                        kind: "create".to_string(),
                        verb_en: "Created".to_string(),
                        verb_ru: "Создаю".to_string(),
                        file_name: Some(fname_display),
                        file_ext,
                        diff_stats: Some(diff_stats),
                        detail: format!("Created {path_raw}"),
                    });
                }
                "edit_file" => {
                    let path_raw = args
                        .and_then(|a| a.get("Path"))
                        .and_then(|p| p.as_str())
                        .unwrap_or_default();
                    let (file_name, file_ext) = extract_filename_and_ext(path_raw);
                    let target_raw = args
                        .and_then(|a| a.get("Target"))
                        .and_then(|t| t.as_str())
                        .unwrap_or_default();
                    let replacement_raw = args
                        .and_then(|a| a.get("Replacement"))
                        .and_then(|r| r.as_str())
                        .unwrap_or_default();
                    let added = replacement_raw.lines().count().max(1);
                    let removed = target_raw.lines().count().max(1);
                    let diff_stats = format!("+{added} -{removed}");
                    let fname_display = file_name.clone().unwrap_or_else(|| "файл".to_string());
                    actions.push(ToolAction {
                        kind: "edit".to_string(),
                        verb_en: "Edited".to_string(),
                        verb_ru: "Редактирую".to_string(),
                        file_name: Some(fname_display),
                        file_ext,
                        diff_stats: Some(diff_stats),
                        detail: format!("Edited {path_raw}"),
                    });
                }
                "read_file" => {
                    let path_raw = args
                        .and_then(|a| a.get("Path"))
                        .and_then(|p| p.as_str())
                        .unwrap_or_default();
                    let (file_name, file_ext) = extract_filename_and_ext(path_raw);
                    let fname_display = file_name
                        .clone()
                        .unwrap_or_else(|| clean_path_string(path_raw));
                    let detail = format!("read {fname_display}");
                    actions.push(ToolAction {
                        kind: "read".to_string(),
                        verb_en: "Ran".to_string(),
                        verb_ru: "Читаю".to_string(),
                        file_name,
                        file_ext,
                        diff_stats: None,
                        detail,
                    });
                }
                "run_command" => {
                    let cmd_raw = args
                        .and_then(|a| a.get("CommandLine"))
                        .and_then(|c| c.as_str())
                        .unwrap_or_default();
                    let summary_raw = args
                        .and_then(|a| a.get("toolSummary").or_else(|| a.get("ToolSummary")))
                        .and_then(|s| s.as_str())
                        .unwrap_or_default();
                    let detail = if !summary_raw.is_empty() {
                        clean_path_string(summary_raw)
                    } else if !cmd_raw.is_empty() {
                        let clean_cmd = clean_path_string(cmd_raw);
                        truncate_chars(&clean_cmd, 70)
                    } else {
                        "команда терминала".to_string()
                    };
                    actions.push(ToolAction {
                        kind: "run".to_string(),
                        verb_en: "Ran".to_string(),
                        verb_ru: "Выполняю".to_string(),
                        file_name: None,
                        file_ext: None,
                        diff_stats: None,
                        detail,
                    });
                }
                "search_web" | "gemini_search_docs" | "free_web_search" => {
                    let q = args
                        .and_then(|a| a.get("query"))
                        .and_then(|q| q.as_str())
                        .unwrap_or_default();
                    let clean_q = clean_path_string(q);
                    actions.push(ToolAction {
                        kind: "search".to_string(),
                        verb_en: "Ran".to_string(),
                        verb_ru: "Выполняю".to_string(),
                        file_name: None,
                        file_ext: None,
                        diff_stats: None,
                        detail: format!("search {}", truncate_chars(&clean_q, 60)),
                    });
                }
                _ => {
                    let detail = if !name.is_empty() {
                        name.to_string()
                    } else {
                        "действие".to_string()
                    };
                    actions.push(ToolAction {
                        kind: "other".to_string(),
                        verb_en: "Ran".to_string(),
                        verb_ru: "Выполняю".to_string(),
                        file_name: None,
                        file_ext: None,
                        diff_stats: None,
                        detail,
                    });
                }
            }
        }
    }

    if actions.is_empty() {
        if step_type == "USER_INPUT" {
            let first_line = cleaned_content.lines().next().unwrap_or("Запрос").trim();
            actions.push(ToolAction {
                kind: "user".to_string(),
                verb_en: "Prompt".to_string(),
                verb_ru: "Промпт".to_string(),
                file_name: None,
                file_ext: None,
                diff_stats: None,
                detail: truncate_chars(first_line, 80),
            });
        } else if let Some(thinking) = val.get("thinking").and_then(|t| t.as_str()) {
            let trimmed = thinking.trim();
            if !trimmed.is_empty() {
                let first_sentence = trimmed.lines().next().unwrap_or(trimmed).trim();
                actions.push(ToolAction {
                    kind: "think".to_string(),
                    verb_en: "Analyzed".to_string(),
                    verb_ru: "Анализирую".to_string(),
                    file_name: None,
                    file_ext: None,
                    diff_stats: None,
                    detail: truncate_chars(first_sentence, 80),
                });
            }
        } else if !cleaned_content.is_empty() {
            let first_line = cleaned_content.lines().next().unwrap_or("Ответ").trim();
            actions.push(ToolAction {
                kind: "generic".to_string(),
                verb_en: "Responded".to_string(),
                verb_ru: "Отвечаю".to_string(),
                file_name: None,
                file_ext: None,
                diff_stats: None,
                detail: truncate_chars(first_line, 80),
            });
        }
    }

    actions
}

pub fn parse_transcript(path: &Path, limit: usize) -> Vec<TranscriptStep> {
    let Ok(file) = File::open(path) else {
        return Vec::new();
    };
    let reader = BufReader::new(file);
    let mut steps = Vec::new();

    for line in reader.lines().map_while(Result::ok) {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }
        let Ok(val) = serde_json::from_str::<Value>(trimmed) else {
            continue;
        };

        let step_type = val
            .get("type")
            .and_then(|v| v.as_str())
            .unwrap_or_default()
            .to_string();
        let source = val
            .get("source")
            .and_then(|v| v.as_str())
            .unwrap_or_default()
            .to_string();

        let raw_content = val
            .get("content")
            .and_then(|v| v.as_str())
            .unwrap_or_default()
            .trim();
        let cleaned = raw_content
            .replace("<USER_REQUEST>", "")
            .replace("</USER_REQUEST>", "")
            .trim()
            .to_string();

        let tool_names = val
            .get("tool_calls")
            .and_then(|v| v.as_array())
            .map(|arr| {
                arr.iter()
                    .filter_map(|t| {
                        t.get("name")
                            .or_else(|| t.get("function").and_then(|f| f.get("name")))
                            .and_then(|n| n.as_str())
                            .map(str::to_string)
                    })
                    .collect::<Vec<_>>()
            })
            .unwrap_or_default();

        let actions = parse_tool_actions(&val, &step_type, &cleaned);

        steps.push(TranscriptStep {
            step_index: val.get("step_index").and_then(|v| v.as_u64()).unwrap_or(0),
            source,
            step_type,
            status: val
                .get("status")
                .and_then(|v| v.as_str())
                .unwrap_or_default()
                .to_string(),
            created_at: val
                .get("created_at")
                .and_then(|v| v.as_str())
                .unwrap_or_default()
                .to_string(),
            content_preview: truncate_chars(&cleaned, 600),
            tool_names,
            input_tokens: val.get("input_tokens").and_then(|v| v.as_u64()).unwrap_or(0),
            output_tokens: val
                .get("output_tokens")
                .and_then(|v| v.as_u64())
                .unwrap_or(0),
            actions,
        });
    }

    if steps.len() > limit {
        steps.drain(0..(steps.len() - limit));
    }
    steps
}

fn infer_title_from_transcript(transcript_path: &Path, fallback_id: &str) -> String {
    let steps = parse_transcript(transcript_path, 12);
    for step in &steps {
        if step.step_type == "USER_INPUT" && !step.content_preview.is_empty() {
            let first_line = step
                .content_preview
                .lines()
                .map(str::trim)
                .find(|l| !l.is_empty() && !l.starts_with('<'))
                .unwrap_or(fallback_id);
            return truncate_chars(first_line, 64);
        }
    }
    format!("Сессия {}", &fallback_id[..fallback_id.len().min(8)])
}

pub fn scan_sessions(brain_dir: &Path) -> Vec<SessionSummary> {
    let Ok(entries) = fs::read_dir(brain_dir) else {
        return Vec::new();
    };
    let current = now_ms();
    let mut sessions = Vec::new();

    for entry in entries.flatten() {
        let root = entry.path();
        if !root.is_dir() {
            continue;
        }
        let Some(id) = root.file_name().and_then(|n| n.to_str()).map(str::to_string) else {
            continue;
        };
        let sys_dir = root.join(".system_generated");
        if !sys_dir.exists() {
            continue;
        }

        let swarm_dir = sys_dir.join("swarm");
        let swarm_json = swarm_dir.join("swarm.json");
        let members_json = swarm_dir.join("members.json");
        let board_jsonl = swarm_dir.join("board.jsonl");
        let subagents_dir = sys_dir.join("subagents");
        let transcript_jsonl = sys_dir.join("logs").join("transcript.jsonl");

        let has_swarm = swarm_json.exists() || members_json.exists() || board_jsonl.exists();
        let subagents = parse_subagents_dir(&subagents_dir, &id);

        if !has_swarm && subagents.is_empty() {
            continue;
        }

        let meta = parse_swarm_meta(&swarm_json);
        let (member_title, members) = parse_members(&members_json);
        let board = parse_board(&board_jsonl);

        let title = if !member_title.is_empty() {
            member_title
        } else {
            infer_title_from_transcript(&transcript_jsonl, &id)
        };

        let mut channel_set = BTreeSet::new();
        channel_set.insert("main".to_string());
        for m in &members {
            for ch in &m.channels {
                channel_set.insert(ch.clone());
            }
        }
        for msg in &board {
            if !msg.channel.is_empty() {
                channel_set.insert(msg.channel.clone());
            }
        }

        let updated_at_ms = [
            modified_ms(&board_jsonl),
            modified_ms(&members_json),
            modified_ms(&transcript_jsonl),
            modified_ms(&subagents_dir),
        ]
        .into_iter()
        .max()
        .unwrap_or(0);

        let recently_touched = current.saturating_sub(updated_at_ms) < 5 * 60 * 1000;
        let has_working = members
            .iter()
            .any(|m| !m.killed && m.wake_mode == "working");
        let is_live = recently_touched || has_working;

        sessions.push(SessionSummary {
            id,
            title,
            has_swarm,
            is_live,
            created_at: meta.map(|m| m.created_at).unwrap_or_default(),
            updated_at_ms,
            member_count: members.len(),
            subagent_count: subagents.len(),
            board_count: board.len(),
            channels: channel_set.into_iter().collect(),
            root_path: root.to_string_lossy().to_string(),
            source: Some("antigravity".to_string()),
            platform: "antigravity".to_string(),
        });
    }

    if let Some(home) = dirs::home_dir() {
        let codex_index = home.join(".codex").join("session_index.jsonl");
        if codex_index.exists() {
            if let Ok(file) = File::open(&codex_index) {
                let reader = BufReader::new(file);
                for line in reader.lines().map_while(Result::ok).take(12) {
                    if let Ok(val) = serde_json::from_str::<Value>(&line) {
                        let id = val.get("id").and_then(|v| v.as_str()).unwrap_or_default().to_string();
                        let title = val.get("thread_name").and_then(|v| v.as_str()).unwrap_or("Codex Session").to_string();
                        if !id.is_empty() {
                            sessions.push(SessionSummary {
                                id: format!("codex:{id}"),
                                title: format!("Codex · {title}"),
                                has_swarm: false,
                                is_live: false,
                                created_at: String::new(),
                                updated_at_ms: 0,
                                member_count: 1,
                                subagent_count: 0,
                                board_count: 0,
                                channels: vec!["main".to_string()],
                                root_path: home.join(".codex").join("sessions").to_string_lossy().to_string(),
                                source: Some("codex".to_string()),
                                platform: "codex".to_string(),
                            });
                        }
                    }
                }
            }
        }
    }

    if let Some(home) = dirs::home_dir() {
        let claude_projects_dir = home.join(".claude").join("projects");
        if claude_projects_dir.exists() && claude_projects_dir.is_dir() {
            if let Ok(entries) = fs::read_dir(&claude_projects_dir) {
                for entry in entries.flatten().take(12) {
                    if entry.path().is_dir() {
                        let name = entry.file_name().to_string_lossy().to_string();
                        sessions.push(SessionSummary {
                            id: format!("claude:{name}"),
                            title: format!("Claude · {name}"),
                            has_swarm: false,
                            is_live: false,
                            created_at: String::new(),
                            updated_at_ms: modified_ms(&entry.path()),
                            member_count: 1,
                            subagent_count: 0,
                            board_count: 0,
                            channels: vec!["main".to_string()],
                            root_path: entry.path().to_string_lossy().to_string(),
                            source: Some("claude".to_string()),
                            platform: "claude_code".to_string(),
                        });
                    }
                }
            }
        }
    }

    sessions.sort_by(|a, b| {
        b.has_swarm
            .cmp(&a.has_swarm)
            .then_with(|| b.updated_at_ms.cmp(&a.updated_at_ms))
    });
    sessions
}

pub fn scan_sessions_with_custom(brain_dir: &Path, custom_paths: &[String]) -> Vec<SessionSummary> {
    let mut sessions = scan_sessions(brain_dir);
    for p_str in custom_paths {
        let pb = PathBuf::from(p_str.trim());
        if !pb.exists() {
            continue;
        }
        let name = pb
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("custom-agent")
            .to_string();
        sessions.push(SessionSummary {
            id: format!("custom:{}", pb.to_string_lossy()),
            title: format!("Кастомный · {name}"),
            has_swarm: pb.join(".system_generated").join("swarm").exists(),
            is_live: false,
            created_at: String::new(),
            updated_at_ms: modified_ms(&pb),
            member_count: 1,
            subagent_count: 0,
            board_count: 0,
            channels: vec!["main".to_string()],
            root_path: pb.to_string_lossy().to_string(),
            source: Some("custom".to_string()),
            platform: "custom".to_string(),
        });
    }
    sessions
}

pub fn load_session_detail(brain_dir: &Path, session_id: &str) -> Option<SessionDetail> {
    if let Some(codex_id) = session_id.strip_prefix("codex:") {
        let title = format!("Codex · {codex_id}");
        let summary = SessionSummary {
            id: session_id.to_string(),
            title: title.clone(),
            has_swarm: false,
            is_live: false,
            created_at: String::new(),
            updated_at_ms: now_ms(),
            member_count: 1,
            subagent_count: 0,
            board_count: 0,
            channels: vec!["main".to_string()],
            root_path: dirs::home_dir()
                .map(|h| h.join(".codex").join("sessions").to_string_lossy().to_string())
                .unwrap_or_default(),
            source: Some("codex".to_string()),
            platform: "codex".to_string(),
        };
        let member = SwarmMember {
            name: "codex-agent".to_string(),
            conversation_id: session_id.to_string(),
            role: "coordinator".to_string(),
            phase: "RUNNING".to_string(),
            desired_state: "RUNNING".to_string(),
            desired_model: "codex".to_string(),
            applied_model: "codex".to_string(),
            model: "codex".to_string(),
            workspace_mode: "inherit".to_string(),
            wake_mode: "working".to_string(),
            wait_since: 0,
            last_read_seq: 0,
            killed: false,
            channels: vec!["main".to_string()],
        };
        return Some(SessionDetail {
            summary,
            swarm_meta: None,
            members: vec![member],
            board: Vec::new(),
            subagents: Vec::new(),
            transcripts: HashMap::new(),
            platform: "codex".to_string(),
        });
    }

    if let Some(claude_id) = session_id.strip_prefix("claude:") {
        let title = format!("Claude · {claude_id}");
        let summary = SessionSummary {
            id: session_id.to_string(),
            title: title.clone(),
            has_swarm: false,
            is_live: false,
            created_at: String::new(),
            updated_at_ms: now_ms(),
            member_count: 1,
            subagent_count: 0,
            board_count: 0,
            channels: vec!["main".to_string()],
            root_path: dirs::home_dir()
                .map(|h| h.join(".claude").join("projects").to_string_lossy().to_string())
                .unwrap_or_default(),
            source: Some("claude".to_string()),
            platform: "claude_code".to_string(),
        };
        let member = SwarmMember {
            name: "claude-code".to_string(),
            conversation_id: session_id.to_string(),
            role: "coordinator".to_string(),
            phase: "RUNNING".to_string(),
            desired_state: "RUNNING".to_string(),
            desired_model: "claude-3-7-sonnet".to_string(),
            applied_model: "claude-3-7-sonnet".to_string(),
            model: "claude-3-7-sonnet".to_string(),
            workspace_mode: "inherit".to_string(),
            wake_mode: "working".to_string(),
            wait_since: 0,
            last_read_seq: 0,
            killed: false,
            channels: vec!["main".to_string()],
        };
        return Some(SessionDetail {
            summary,
            swarm_meta: None,
            members: vec![member],
            board: Vec::new(),
            subagents: Vec::new(),
            transcripts: HashMap::new(),
            platform: "claude_code".to_string(),
        });
    }

    if let Some(custom_id) = session_id.strip_prefix("custom:") {
        let title = format!("Кастомный · {custom_id}");
        let summary = SessionSummary {
            id: session_id.to_string(),
            title: title.clone(),
            has_swarm: false,
            is_live: false,
            created_at: String::new(),
            updated_at_ms: now_ms(),
            member_count: 1,
            subagent_count: 0,
            board_count: 0,
            channels: vec!["main".to_string()],
            root_path: custom_id.to_string(),
            source: Some("custom".to_string()),
            platform: "custom".to_string(),
        };
        let member = SwarmMember {
            name: "custom-agent".to_string(),
            conversation_id: session_id.to_string(),
            role: "coordinator".to_string(),
            phase: "RUNNING".to_string(),
            desired_state: "RUNNING".to_string(),
            desired_model: "custom".to_string(),
            applied_model: "custom".to_string(),
            model: "custom".to_string(),
            workspace_mode: "inherit".to_string(),
            wake_mode: "working".to_string(),
            wait_since: 0,
            last_read_seq: 0,
            killed: false,
            channels: vec!["main".to_string()],
        };
        return Some(SessionDetail {
            summary,
            swarm_meta: None,
            members: vec![member],
            board: Vec::new(),
            subagents: Vec::new(),
            transcripts: HashMap::new(),
            platform: "custom".to_string(),
        });
    }

    let root = brain_dir.join(session_id);
    if !root.is_dir() {
        return None;
    }
    let sys_dir = root.join(".system_generated");
    let swarm_dir = sys_dir.join("swarm");
    let swarm_json = swarm_dir.join("swarm.json");
    let members_json = swarm_dir.join("members.json");
    let board_jsonl = swarm_dir.join("board.jsonl");
    let subagents_dir = sys_dir.join("subagents");
    let main_transcript = sys_dir.join("logs").join("transcript.jsonl");

    let meta = parse_swarm_meta(&swarm_json);
    let (member_title, members) = parse_members(&members_json);
    let board = parse_board(&board_jsonl);
    let mut subagents = parse_subagents_dir(&subagents_dir, session_id);

    let mut seen_sub_ids: BTreeSet<String> =
        subagents.iter().map(|s| s.conversation_id.clone()).collect();
    for member in &members {
        if member.conversation_id.is_empty() || member.conversation_id == session_id {
            continue;
        }
        let child_sub_dir = brain_dir
            .join(&member.conversation_id)
            .join(".system_generated")
            .join("subagents");
        for child in parse_subagents_dir(&child_sub_dir, &member.conversation_id) {
            if seen_sub_ids.insert(child.conversation_id.clone()) {
                subagents.push(child);
            }
        }
    }

    let mut transcripts: HashMap<String, Vec<TranscriptStep>> = HashMap::new();
    let main_steps = parse_transcript(&main_transcript, 120);
    if !main_steps.is_empty() {
        transcripts.insert(session_id.to_string(), main_steps);
    }

    for member in &members {
        if member.conversation_id.is_empty() || transcripts.contains_key(&member.conversation_id) {
            continue;
        }
        let t_path = brain_dir
            .join(&member.conversation_id)
            .join(".system_generated")
            .join("logs")
            .join("transcript.jsonl");
        let steps = parse_transcript(&t_path, 80);
        if !steps.is_empty() {
            transcripts.insert(member.conversation_id.clone(), steps);
        }
    }

    for sub in &subagents {
        if sub.conversation_id.is_empty() || transcripts.contains_key(&sub.conversation_id) {
            continue;
        }
        let t_path = brain_dir
            .join(&sub.conversation_id)
            .join(".system_generated")
            .join("logs")
            .join("transcript.jsonl");
        let steps = parse_transcript(&t_path, 80);
        if !steps.is_empty() {
            transcripts.insert(sub.conversation_id.clone(), steps);
        }
    }

    let has_swarm = meta.is_some() || !members.is_empty() || !board.is_empty();
    let title = if !member_title.is_empty() {
        member_title
    } else {
        infer_title_from_transcript(&main_transcript, session_id)
    };

    let mut channel_set = BTreeSet::new();
    channel_set.insert("main".to_string());
    for m in &members {
        for ch in &m.channels {
            channel_set.insert(ch.clone());
        }
    }
    for msg in &board {
        if !msg.channel.is_empty() {
            channel_set.insert(msg.channel.clone());
        }
    }

    let updated_at_ms = [
        modified_ms(&board_jsonl),
        modified_ms(&members_json),
        modified_ms(&main_transcript),
    ]
    .into_iter()
    .max()
    .unwrap_or(0);

    let current = now_ms();
    let is_live = current.saturating_sub(updated_at_ms) < 5 * 60 * 1000
        || members
            .iter()
            .any(|m| !m.killed && m.wake_mode == "working");

    let summary = SessionSummary {
        id: session_id.to_string(),
        title,
        has_swarm,
        is_live,
        created_at: meta.as_ref().map(|m| m.created_at.clone()).unwrap_or_default(),
        updated_at_ms,
        member_count: members.len(),
        subagent_count: subagents.len(),
        board_count: board.len(),
        channels: channel_set.into_iter().collect(),
        root_path: root.to_string_lossy().to_string(),
        source: Some("antigravity".to_string()),
        platform: "antigravity".to_string(),
    };

    Some(SessionDetail {
        summary,
        swarm_meta: meta,
        members,
        board,
        subagents,
        transcripts,
        platform: "antigravity".to_string(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    #[test]
    fn extracts_mentions_and_seq_refs() {
        let text = "@verifier check #4 and #12 from @bexum-audit; ignore email test@example.com";
        let mentions = extract_mentions(text);
        assert!(mentions.contains(&"verifier".to_string()));
        assert!(mentions.contains(&"bexum-audit".to_string()));

        let refs = extract_seq_refs(text);
        assert_eq!(refs, vec![4, 12]);
    }

    #[test]
    fn parses_synthetic_swarm_session() {
        let tmp = std::env::temp_dir().join("swarm_graph_unit_test");
        let _ = fs::remove_dir_all(&tmp);
        let conv = tmp.join("conv-1");
        let swarm_dir = conv.join(".system_generated").join("swarm");
        let sub_dir = conv.join(".system_generated").join("subagents");
        fs::create_dir_all(&swarm_dir).unwrap();
        fs::create_dir_all(&sub_dir).unwrap();

        fs::write(
            swarm_dir.join("swarm.json"),
            r#"{"version":1,"backend":"local","swarm_id":"conv-1","created_at":"2026-11-11T10:00:00Z"}"#,
        )
        .unwrap();

        fs::write(
            swarm_dir.join("members.json"),
            r#"{"title":"Test Swarm","members":{"coordinator":{"conversation_id":"conv-1","role":"coordinator","phase":"RUNNING","model":"gemini-3.8-flash","wake_mode":"mentions","killed":false},"worker-a":{"conversation_id":"conv-2","role":"worker","phase":"RUNNING","model":"gemini-3.8-flash","wake_mode":"working","killed":false}}}"#,
        )
        .unwrap();

        let mut board_file = File::create(swarm_dir.join("board.jsonl")).unwrap();
        writeln!(
            board_file,
            r#"{{"seq":1,"agent":"coordinator","text":"@worker-a start task","time":"2026-11-11 10:00:01","kind":"brief","request_id":"r1"}}"#
        )
        .unwrap();
        writeln!(
            board_file,
            r#"{{"seq":2,"agent":"worker-a","text":"@coordinator done #1","time":"2026-11-11 10:00:05","kind":"post","request_id":"r2"}}"#
        )
        .unwrap();

        fs::write(
            sub_dir.join("sub-1.json"),
            r#"{"conversationId":"sub-1","subagentDescriptor":{"typeName":"research","role":"Code Searcher"},"state":"SUBAGENT_STATE_ALIVE","spawnStepIndex":3}"#,
        )
        .unwrap();

        let summaries = scan_sessions(&tmp);
        assert_eq!(summaries.len(), 1);
        assert_eq!(summaries[0].title, "Test Swarm");
        assert_eq!(summaries[0].member_count, 2);
        assert_eq!(summaries[0].subagent_count, 1);
        assert_eq!(summaries[0].board_count, 2);

        let detail = load_session_detail(&tmp, "conv-1").unwrap();
        assert_eq!(detail.board[1].mentions, vec!["coordinator".to_string()]);
        assert_eq!(detail.board[1].seq_refs, vec![1]);
        assert_eq!(detail.subagents[0].role, "Code Searcher");

        let _ = fs::remove_dir_all(&tmp);
    }
}
