mod exporter;
pub mod models;
pub mod scanner;
pub mod translator;
mod watcher;

use models::{SessionDetail, SessionSummary};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{AppHandle, Manager, State};
use translator::TranslatorService;
use watcher::BrainWatcher;

struct AppState {
    brain_dir: Mutex<PathBuf>,
    watcher: BrainWatcher,
    translator: TranslatorService,
}

#[tauri::command]
fn get_brain_dir(state: State<'_, AppState>) -> Result<String, String> {
    let guard = state
        .brain_dir
        .lock()
        .map_err(|_| "Ошибка чтения brain_dir".to_string())?;
    Ok(guard.to_string_lossy().to_string())
}

#[tauri::command]
fn set_brain_dir(
    app: AppHandle,
    state: State<'_, AppState>,
    path: String,
) -> Result<String, String> {
    let pb = PathBuf::from(path.trim());
    if !pb.exists() || !pb.is_dir() {
        return Err("Указанная папка не существует".to_string());
    }
    {
        let mut guard = state
            .brain_dir
            .lock()
            .map_err(|_| "Ошибка записи brain_dir".to_string())?;
        *guard = pb.clone();
    }
    state.watcher.start(app, pb.clone())?;
    Ok(pb.to_string_lossy().to_string())
}

#[tauri::command]
fn list_sessions(state: State<'_, AppState>) -> Result<Vec<SessionSummary>, String> {
    let dir = state
        .brain_dir
        .lock()
        .map_err(|_| "Ошибка доступа к brain_dir".to_string())?
        .clone();
    Ok(scanner::scan_sessions(&dir))
}

#[tauri::command]
fn list_sessions_multi(
    state: State<'_, AppState>,
    custom_paths: Option<Vec<String>>,
) -> Result<Vec<SessionSummary>, String> {
    let dir = state
        .brain_dir
        .lock()
        .map_err(|_| "Ошибка доступа к brain_dir".to_string())?
        .clone();
    Ok(scanner::scan_sessions_with_custom(
        &dir,
        &custom_paths.unwrap_or_default(),
    ))
}

#[tauri::command]
fn get_session_detail(
    state: State<'_, AppState>,
    session_id: String,
) -> Result<Option<SessionDetail>, String> {
    let dir = state
        .brain_dir
        .lock()
        .map_err(|_| "Ошибка доступа к brain_dir".to_string())?
        .clone();
    Ok(scanner::load_session_detail(&dir, &session_id))
}

#[tauri::command]
async fn translate_texts_to_ru(
    state: State<'_, AppState>,
    texts: Vec<String>,
) -> Result<HashMap<String, String>, String> {
    Ok(state.translator.translate_batch(texts).await)
}

#[tauri::command]
fn check_ffmpeg() -> bool {
    exporter::has_ffmpeg_installed()
}

#[tauri::command]
fn save_export_binary(output_path: String, base64_data: String) -> Result<String, String> {
    exporter::save_binary_file(&output_path, &base64_data)
}

#[tauri::command]
async fn export_frames_ffmpeg(
    frames_base64: Vec<String>,
    fps: u32,
    output_path: String,
    format: String,
) -> Result<String, String> {
    tokio::task::spawn_blocking(move || {
        exporter::transcode_frames_to_media(frames_base64, fps, &output_path, &format)
    })
    .await
    .map_err(|e| format!("Ошибка фоновой задачи экспорта: {e}"))?
}

#[tauri::command]
fn minimize_window(window: tauri::Window) {
    let _ = window.minimize();
}

#[tauri::command]
fn toggle_maximize_window(window: tauri::Window) {
    if let Ok(is_max) = window.is_maximized() {
        if is_max {
            let _ = window.unmaximize();
        } else {
            let _ = window.maximize();
        }
    }
}

#[tauri::command]
fn close_window(window: tauri::Window) {
    let _ = window.close();
}

#[tauri::command]
fn start_dragging_window(window: tauri::Window) {
    let _ = window.start_dragging();
}

#[tauri::command]
fn post_swarm_message(
    state: State<'_, AppState>,
    session_id: String,
    text: String,
    agent: Option<String>,
) -> Result<u64, String> {
    let dir = state
        .brain_dir
        .lock()
        .map_err(|_| "Ошибка доступа к brain_dir".to_string())?
        .clone();
    let swarm_dir = dir.join(&session_id).join(".system_generated").join("swarm");
    let board_path = swarm_dir.join("board.jsonl");
    let _ = std::fs::create_dir_all(&swarm_dir);

    let existing = scanner::parse_board(&board_path);
    let next_seq = (existing.len() as u64) + 1;
    let sender = agent.unwrap_or_else(|| "coordinator".to_string());
    let mentions = scanner::extract_mentions(&text);
    let seq_refs = scanner::extract_seq_refs(&text);

    let now_secs = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    let hours = (now_secs % 86400) / 3600;
    let mins = (now_secs % 3600) / 60;
    let secs = now_secs % 60;
    let time_str = format!("2026-11-15 {:02}:{:02}:{:02}", hours, mins, secs);

    let new_msg = serde_json::json!({
        "seq": next_seq,
        "agent": sender,
        "text": text,
        "time": time_str,
        "kind": "post",
        "request_id": format!("gui-{}", next_seq),
        "channel": "main",
        "mentions": mentions,
        "seq_refs": seq_refs
    });

    use std::io::Write;
    let mut file = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&board_path)
        .map_err(|e| format!("Не удалось открыть board.jsonl: {e}"))?;
    writeln!(file, "{}", new_msg).map_err(|e| format!("Не удалось записать сообщение: {e}"))?;

    Ok(next_seq)
}

#[tauri::command]
fn add_swarm_worker(
    state: State<'_, AppState>,
    session_id: String,
    name: String,
    role: String,
    model: String,
    brief: String,
) -> Result<(), String> {
    let dir = state
        .brain_dir
        .lock()
        .map_err(|_| "Ошибка доступа к brain_dir".to_string())?
        .clone();
    let swarm_dir = dir.join(&session_id).join(".system_generated").join("swarm");
    let members_path = swarm_dir.join("members.json");
    let board_path = swarm_dir.join("board.jsonl");
    let _ = std::fs::create_dir_all(&swarm_dir);

    let mut root: serde_json::Value = if members_path.exists() {
        let content = std::fs::read_to_string(&members_path).unwrap_or_default();
        serde_json::from_str(&content).unwrap_or_else(|_| serde_json::json!({"members": []}))
    } else {
        serde_json::json!({
            "title": format!("Swarm {}", &session_id[..session_id.len().min(8)]),
            "members": []
        })
    };

    let new_member = serde_json::json!({
        "name": name,
        "conversation_id": format!("{}-{}", session_id, name),
        "role": role,
        "phase": "RUNNING",
        "desired_state": "RUNNING",
        "desired_model": model,
        "applied_model": model,
        "model": model,
        "workspace_mode": "inherit",
        "wake_mode": "working",
        "wait_since": 0,
        "last_read_seq": 0,
        "killed": false,
        "channels": ["main"]
    });

    if let Some(arr) = root.get_mut("members").and_then(|m| m.as_array_mut()) {
        arr.retain(|item| item.get("name").and_then(|n| n.as_str()) != Some(&name));
        arr.push(new_member);
    }
    let _ = std::fs::write(&members_path, serde_json::to_string_pretty(&root).unwrap_or_default());

    let existing = scanner::parse_board(&board_path);
    let next_seq = (existing.len() as u64) + 1;
    let brief_text = format!("@{name} {brief}");
    let mentions = scanner::extract_mentions(&brief_text);

    let now_secs = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    let hours = (now_secs % 86400) / 3600;
    let mins = (now_secs % 3600) / 60;
    let secs = now_secs % 60;
    let time_str = format!("2026-11-15 {:02}:{:02}:{:02}", hours, mins, secs);

    let new_msg = serde_json::json!({
        "seq": next_seq,
        "agent": "coordinator",
        "text": brief_text,
        "time": time_str,
        "kind": "brief",
        "request_id": format!("brief-{}", next_seq),
        "channel": "main",
        "mentions": mentions,
        "seq_refs": []
    });

    use std::io::Write;
    let mut file = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&board_path)
        .map_err(|e| format!("Не удалось открыть board.jsonl: {e}"))?;
    writeln!(file, "{}", new_msg).map_err(|e| format!("Не удалось записать бриф: {e}"))?;

    Ok(())
}

#[tauri::command]
fn kill_swarm_worker(
    state: State<'_, AppState>,
    session_id: String,
    name: String,
) -> Result<(), String> {
    let dir = state
        .brain_dir
        .lock()
        .map_err(|_| "Ошибка доступа к brain_dir".to_string())?
        .clone();
    let members_path = dir
        .join(&session_id)
        .join(".system_generated")
        .join("swarm")
        .join("members.json");
    if !members_path.exists() {
        return Ok(());
    }
    let content = std::fs::read_to_string(&members_path).unwrap_or_default();
    let mut root: serde_json::Value =
        serde_json::from_str(&content).map_err(|e| e.to_string())?;
    if let Some(arr) = root.get_mut("members").and_then(|m| m.as_array_mut()) {
        for m in arr.iter_mut() {
            if m.get("name").and_then(|n| n.as_str()) == Some(&name) {
                m["killed"] = serde_json::Value::Bool(true);
                m["wake_mode"] = serde_json::Value::String("killed".to_string());
                m["desired_state"] = serde_json::Value::String("STOPPED".to_string());
            }
        }
    }
    let _ = std::fs::write(&members_path, serde_json::to_string_pretty(&root).unwrap_or_default());
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let default_dir = scanner::default_brain_dir();
    let app_state = AppState {
        brain_dir: Mutex::new(default_dir.clone()),
        watcher: BrainWatcher::new(),
        translator: TranslatorService::new(),
    };

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(app_state)
        .setup(move |app| {
            let handle = app.handle().clone();
            let dir_clone = default_dir.clone();
            std::thread::spawn(move || {
                let state = handle.state::<AppState>();
                let _ = state.watcher.start(handle.clone(), dir_clone);
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_brain_dir,
            set_brain_dir,
            list_sessions,
            list_sessions_multi,
            get_session_detail,
            translate_texts_to_ru,
            check_ffmpeg,
            save_export_binary,
            export_frames_ffmpeg,
            minimize_window,
            toggle_maximize_window,
            close_window,
            start_dragging_window,
            post_swarm_message,
            add_swarm_worker,
            kill_swarm_worker,
        ])
        .run(tauri::generate_context!())
        .expect("ошибка запуска SwarmGraph");
}
