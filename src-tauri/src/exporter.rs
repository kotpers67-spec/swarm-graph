use base64::{engine::general_purpose::STANDARD, Engine as _};
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

fn find_ffmpeg() -> Option<PathBuf> {
    if let Ok(output) = Command::new("where").arg("ffmpeg").output() {
        if output.status.success() {
            let stdout = String::from_utf8_lossy(&output.stdout);
            if let Some(first) = stdout.lines().map(str::trim).find(|l| !l.is_empty()) {
                return Some(PathBuf::from(first));
            }
        }
    }
    if let Some(local) = dirs::data_local_dir() {
        let winget_pkgs = local.join("Microsoft").join("WinGet").join("Packages");
        if winget_pkgs.exists() {
            if let Ok(entries) = fs::read_dir(&winget_pkgs) {
                for e in entries.flatten() {
                    let name = e.file_name().to_string_lossy().to_string();
                    if name.starts_with("Gyan.FFmpeg") {
                        let candidate = find_exe_recursive(&e.path(), "ffmpeg.exe", 4);
                        if candidate.is_some() {
                            return candidate;
                        }
                    }
                }
            }
        }
    }
    None
}

fn find_exe_recursive(dir: &Path, target: &str, depth: usize) -> Option<PathBuf> {
    if depth == 0 {
        return None;
    }
    let entries = fs::read_dir(dir).ok()?;
    for entry in entries.flatten() {
        let p = entry.path();
        if p.is_file() && p.file_name().and_then(|n| n.to_str()) == Some(target) {
            return Some(p);
        }
        if p.is_dir() {
            if let Some(found) = find_exe_recursive(&p, target, depth - 1) {
                return Some(found);
            }
        }
    }
    None
}

pub fn has_ffmpeg_installed() -> bool {
    find_ffmpeg().is_some()
}

pub fn save_binary_file(target_path: &str, base64_data: &str) -> Result<String, String> {
    let bytes = STANDARD
        .decode(base64_data)
        .map_err(|e| format!("Ошибка декодирования данных экспорта: {e}"))?;
    fs::write(target_path, bytes).map_err(|e| format!("Не удалось записать файл: {e}"))?;
    Ok(target_path.to_string())
}

pub fn transcode_frames_to_media(
    frames_base64: Vec<String>,
    fps: u32,
    output_path: &str,
    format: &str,
) -> Result<String, String> {
    let ffmpeg = find_ffmpeg().ok_or_else(|| {
        "FFmpeg не найден в системе. Используйте встроенный GIF/WebM экспорт.".to_string()
    })?;

    let stamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);
    let tmp_dir = std::env::temp_dir().join(format!("swarmgraph_export_{stamp}"));
    fs::create_dir_all(&tmp_dir).map_err(|e| format!("Ошибка создания temp-папки: {e}"))?;

    for (idx, b64) in frames_base64.iter().enumerate() {
        let clean = b64.split(',').next_back().unwrap_or(b64);
        let bytes = STANDARD
            .decode(clean)
            .map_err(|e| format!("Ошибка декодирования кадра {idx}: {e}"))?;
        let frame_path = tmp_dir.join(format!("frame_{idx:04}.png"));
        fs::write(&frame_path, bytes).map_err(|e| format!("Ошибка записи кадра {idx}: {e}"))?;
    }

    let input_pattern = tmp_dir.join("frame_%04d.png");
    let fps_str = fps.max(1).to_string();

    let status = if format.eq_ignore_ascii_case("gif") {
        let filter = format!(
            "fps={fps_str},scale=1280:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=256:stats_mode=diff[p];[s1][p]paletteuse=dither=bayer:bayer_scale=3"
        );
        Command::new(&ffmpeg)
            .args([
                "-y",
                "-framerate",
                &fps_str,
                "-i",
                &input_pattern.to_string_lossy(),
                "-vf",
                &filter,
                output_path,
            ])
            .output()
    } else {
        Command::new(&ffmpeg)
            .args([
                "-y",
                "-framerate",
                &fps_str,
                "-i",
                &input_pattern.to_string_lossy(),
                "-c:v",
                "libx264",
                "-pix_fmt",
                "yuv420p",
                "-crf",
                "18",
                "-movflags",
                "+faststart",
                output_path,
            ])
            .output()
    };

    let _ = fs::remove_dir_all(&tmp_dir);

    match status {
        Ok(out) if out.status.success() => Ok(output_path.to_string()),
        Ok(out) => {
            let err = String::from_utf8_lossy(&out.stderr);
            Err(format!("FFmpeg завершился с ошибкой: {err}"))
        }
        Err(e) => Err(format!("Не удалось запустить FFmpeg: {e}")),
    }
}
