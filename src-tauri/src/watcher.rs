use notify::{Config, Event, RecommendedWatcher, RecursiveMode, Watcher};
use serde::Serialize;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter};

#[derive(Clone, Serialize)]
pub struct SwarmWatchEvent {
    pub path: String,
    pub session_id: Option<String>,
}

pub struct BrainWatcher {
    watcher: Arc<Mutex<Option<RecommendedWatcher>>>,
}

fn extract_session_id(brain_dir: &Path, changed_path: &Path) -> Option<String> {
    let rel = changed_path.strip_prefix(brain_dir).ok()?;
    let first = rel.components().next()?;
    Some(first.as_os_str().to_string_lossy().to_string())
}

fn is_relevant_path(path: &Path) -> bool {
    let s = path.to_string_lossy().to_lowercase();
    s.ends_with("swarm.json")
        || s.ends_with("members.json")
        || s.ends_with("board.jsonl")
        || s.ends_with("transcript.jsonl")
        || s.contains("subagents")
}

impl BrainWatcher {
    pub fn new() -> Self {
        Self {
            watcher: Arc::new(Mutex::new(None)),
        }
    }

    pub fn start(&self, app: AppHandle, brain_dir: PathBuf) -> Result<(), String> {
        let mut guard = self
            .watcher
            .lock()
            .map_err(|_| "Не удалось заблокировать watcher".to_string())?;
        *guard = None;

        if !brain_dir.exists() {
            return Ok(());
        }

        let watch_root = brain_dir.clone();
        let last_emit = Arc::new(Mutex::new(Instant::now() - Duration::from_secs(5)));

        let mut watcher = RecommendedWatcher::new(
            move |res: notify::Result<Event>| {
                let Ok(event) = res else {
                    return;
                };
                let relevant = event.paths.iter().find(|p| is_relevant_path(p));
                let Some(path) = relevant else {
                    return;
                };

                if let Ok(mut last) = last_emit.lock() {
                    if last.elapsed() < Duration::from_millis(120) {
                        return;
                    }
                    *last = Instant::now();
                }

                let session_id = extract_session_id(&watch_root, path);
                let payload = SwarmWatchEvent {
                    path: path.to_string_lossy().to_string(),
                    session_id,
                };
                let _ = app.emit("swarm://changed", payload);
            },
            Config::default(),
        )
        .map_err(|e| format!("Ошибка инициализации File Watcher: {e}"))?;

        watcher
            .watch(&brain_dir, RecursiveMode::Recursive)
            .map_err(|e| format!("Ошибка запуска слежения за {}: {e}", brain_dir.display()))?;

        *guard = Some(watcher);
        Ok(())
    }
}
