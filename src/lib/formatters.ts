import type { GraphNode, StylePreset } from "../types";

export function formatRoleRu(kind: GraphNode["kind"]): string {
  switch (kind) {
    case "coordinator":
      return "Координатор";
    case "verifier":
      return "Верификатор";
    case "utility":
      return "Монитор / Нарратор";
    case "subagent":
      return "Субагент";
    default:
      return "Воркер";
  }
}

export function formatStatusRu(status: GraphNode["status"]): string {
  switch (status) {
    case "working":
      return "в работе";
    case "killed":
      return "остановлен";
    case "alive":
      return "активен";
    default:
      return "ожидает";
  }
}

export function shortModelName(model: string): string {
  if (!model) return "auto";
  return model
    .replace("gemini-", "G ")
    .replace("-medium", " Med")
    .replace("-high", " High")
    .replace("-low", " Low")
    .replace("claude-", "Claude ");
}

export function isMostlyEnglish(text: string): boolean {
  let latin = 0;
  let cyr = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if ((c >= 65 && c <= 90) || (c >= 97 && c <= 122)) latin++;
    else if (c >= 0x0400 && c <= 0x04ff) cyr++;
  }
  return (latin >= 4 && cyr === 0) || (latin >= 6 && cyr * 2 < latin);
}

export function formatTimeShort(raw: string): string {
  if (!raw) return "";
  const match = raw.match(/(\d{2}:\d{2}:\d{2})/);
  return match ? match[1] : raw.slice(0, 16);
}

export function presetLabelRu(preset: StylePreset): string {
  switch (preset) {
    case "obsidian":
      return "Obsidian";
    case "blueprint":
      return "Blueprint";
    default:
      return "Graphite";
  }
}
