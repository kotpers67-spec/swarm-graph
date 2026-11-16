import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { open, save } from "@tauri-apps/plugin-dialog";
import type { SessionDetail, SessionSummary } from "../types";

export interface SwarmWatchPayload {
  path: string;
  session_id: string | null;
}

export function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export async function getBrainDir(): Promise<string> {
  if (!isTauriRuntime()) return "";
  return invoke<string>("get_brain_dir");
}

export async function setBrainDir(path: string): Promise<string> {
  if (!isTauriRuntime()) return path;
  return invoke<string>("set_brain_dir", { path });
}

export async function listSessions(): Promise<SessionSummary[]> {
  if (!isTauriRuntime()) return [];
  return invoke<SessionSummary[]>("list_sessions");
}

export async function listSessionsMulti(customPaths?: string[]): Promise<SessionSummary[]> {
  if (!isTauriRuntime()) return [];
  return invoke<SessionSummary[]>("list_sessions_multi", { customPaths });
}

export async function getSessionDetail(sessionId: string): Promise<SessionDetail | null> {
  if (!isTauriRuntime()) return null;
  return invoke<SessionDetail | null>("get_session_detail", { sessionId });
}

export async function translateTextsToRu(texts: string[]): Promise<Record<string, string>> {
  if (!isTauriRuntime() || texts.length === 0) return {};
  return invoke<Record<string, string>>("translate_texts_to_ru", { texts });
}

export async function checkFfmpeg(): Promise<boolean> {
  if (!isTauriRuntime()) return false;
  return invoke<boolean>("check_ffmpeg");
}

export async function saveExportBinary(outputPath: string, base64Data: string): Promise<string> {
  return invoke<string>("save_export_binary", { outputPath, base64Data });
}

export async function exportFramesFfmpeg(
  framesBase64: string[],
  fps: number,
  outputPath: string,
  format: "gif" | "mp4",
): Promise<string> {
  return invoke<string>("export_frames_ffmpeg", {
    framesBase64,
    fps,
    outputPath,
    format,
  });
}

export async function minimizeWindow(): Promise<void> {
  if (!isTauriRuntime()) return;
  return invoke("minimize_window");
}

export async function toggleMaximizeWindow(): Promise<void> {
  if (!isTauriRuntime()) return;
  return invoke("toggle_maximize_window");
}

export async function closeWindow(): Promise<void> {
  if (!isTauriRuntime()) return;
  return invoke("close_window");
}

export async function startDraggingWindow(): Promise<void> {
  if (!isTauriRuntime()) return;
  return invoke("start_dragging_window");
}

export async function pickBrainDirectory(): Promise<string | null> {
  if (!isTauriRuntime()) return null;
  const selected = await open({
    directory: true,
    multiple: false,
    title: "Выберите папку Antigravity brain",
  });
  return typeof selected === "string" ? selected : null;
}

export async function pickExportFile(defaultName: string, extension: string): Promise<string | null> {
  if (!isTauriRuntime()) return null;
  const selected = await save({
    defaultPath: defaultName,
    filters: [{ name: extension.toUpperCase(), extensions: [extension] }],
    title: `Сохранить как ${extension.toUpperCase()}`,
  });
  return typeof selected === "string" ? selected : null;
}

export async function postSwarmMessage(
  sessionId: string,
  text: string,
  agent?: string,
): Promise<number> {
  if (!isTauriRuntime()) return 0;
  return invoke<number>("post_swarm_message", { sessionId, text, agent });
}

export async function addSwarmWorker(
  sessionId: string,
  payload: { name: string; role: string; model: string; brief: string },
): Promise<void> {
  if (!isTauriRuntime()) return;
  return invoke<void>("add_swarm_worker", {
    sessionId,
    name: payload.name,
    role: payload.role,
    model: payload.model,
    brief: payload.brief,
  });
}

export async function killSwarmWorker(
  sessionId: string,
  name: string,
): Promise<void> {
  if (!isTauriRuntime()) return;
  return invoke<void>("kill_swarm_worker", { sessionId, name });
}

export async function subscribeBrainChanges(
  handler: (payload: SwarmWatchPayload) => void,
): Promise<UnlistenFn> {
  if (!isTauriRuntime()) {
    return () => {};
  }
  return listen<SwarmWatchPayload>("swarm://changed", (event) => {
    handler(event.payload);
  });
}
