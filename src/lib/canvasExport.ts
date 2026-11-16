import { GIFEncoder, quantize, applyPalette } from "gifenc";
import { buildSwarmGraph, GRAPH_NODE_HEIGHT, GRAPH_NODE_WIDTH } from "./graphBuilder";
import type { SessionDetail, StylePreset } from "../types";

export interface ExportOptions {
  detail: SessionDetail;
  activeChannel: string;
  customPositions: Record<string, { x: number; y: number }>;
  preset: StylePreset;
  isDark: boolean;
  fps: number;
  format: "gif" | "mp4" | "webm";
  translatedMap: Record<string, string>;
  autoTranslate: boolean;
  onProgress: (percent: number, label: string) => void;
}

interface PaletteColors {
  bg: string;
  panel: string;
  border: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  accent: string;
  ok: string;
  grid: string;
}

function getPalette(preset: StylePreset, isDark: boolean): PaletteColors {
  const accentMap: Record<StylePreset, string> = {
    graphite: isDark ? "#3b82f6" : "#2563eb",
    obsidian: isDark ? "#10b981" : "#059669",
    blueprint: isDark ? "#f59e0b" : "#d97706",
    midnight: isDark ? "#818cf8" : "#6366f1",
  };
  if (isDark) {
    const bgMap: Record<StylePreset, string> = {
      graphite: "#0d0e11",
      obsidian: "#121214",
      blueprint: "#0b0f14",
      midnight: "#080914",
    };
    const panelMap: Record<StylePreset, string> = {
      graphite: "#14161b",
      obsidian: "#18181b",
      blueprint: "#10161f",
      midnight: "#0f1123",
    };
    return {
      bg: bgMap[preset],
      panel: panelMap[preset],
      border: "rgba(255,255,255,0.12)",
      textPrimary: "#ffffff",
      textSecondary: "#e2e8f0",
      textMuted: "#94a3b8",
      accent: accentMap[preset],
      ok: "#10b981",
      grid: "rgba(255,255,255,0.06)",
    };
  }
  return {
    bg: "#f6f7f9",
    panel: "#ffffff",
    border: "rgba(15,23,42,0.14)",
    textPrimary: "#0f172a",
    textSecondary: "#334155",
    textMuted: "#64748b",
    accent: accentMap[preset],
    ok: "#059669",
    grid: "rgba(15,23,42,0.08)",
  };
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.closePath();
}

export function renderFrameToCanvas(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  detail: SessionDetail,
  seqCursor: number | null,
  pulsePhase: number,
  opts: Pick<ExportOptions, "activeChannel" | "customPositions" | "preset" | "isDark" | "translatedMap" | "autoTranslate">,
) {
  const pal = getPalette(opts.preset, opts.isDark);
  ctx.fillStyle = pal.bg;
  ctx.fillRect(0, 0, width, height);

  // Сетка фона
  ctx.fillStyle = pal.grid;
  for (let gx = 20; gx < width; gx += 24) {
    for (let gy = 56; gy < height - 64; gy += 24) {
      ctx.fillRect(gx, gy, 1.5, 1.5);
    }
  }

  // Верхняя шапка кадра
  ctx.fillStyle = pal.panel;
  ctx.fillRect(0, 0, width, 48);
  ctx.strokeStyle = pal.border;
  ctx.beginPath();
  ctx.moveTo(0, 48);
  ctx.lineTo(width, 48);
  ctx.stroke();

  ctx.fillStyle = pal.textPrimary;
  ctx.font = "600 15px Inter, Segoe UI, sans-serif";
  ctx.fillText(`SwarmGraph · ${detail.summary.title.slice(0, 64)}`, 20, 30);

  const maxSeq = detail.board.length > 0 ? detail.board[detail.board.length - 1].seq : 0;
  const shownSeq = seqCursor ?? maxSeq;
  ctx.fillStyle = pal.textMuted;
  ctx.font = "500 13px Inter, Segoe UI, sans-serif";
  const seqLabel = `Шаг #${shownSeq} из #${maxSeq}`;
  const labelW = ctx.measureText(seqLabel).width;
  ctx.fillText(seqLabel, width - labelW - 20, 30);

  const graph = buildSwarmGraph(detail, {
    replaySeq: seqCursor,
    activeChannel: opts.activeChannel,
    customPositions: opts.customPositions,
  });

  if (graph.nodes.length === 0) return;

  // Авто-центрирование графа в области (width x (height - 130))
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const n of graph.nodes) {
    minX = Math.min(minX, n.x);
    minY = Math.min(minY, n.y);
    maxX = Math.max(maxX, n.x + GRAPH_NODE_WIDTH);
    maxY = Math.max(maxY, n.y + GRAPH_NODE_HEIGHT);
  }
  const graphW = Math.max(200, maxX - minX);
  const graphH = Math.max(120, maxY - minY);
  const areaW = width - 80;
  const areaH = height - 150;
  const scale = Math.min(1.08, areaW / graphW, areaH / graphH);
  const offsetX = (width - graphW * scale) / 2 - minX * scale;
  const offsetY = 58 + (areaH - graphH * scale) / 2 - minY * scale;

  ctx.save();
  ctx.translate(offsetX, offsetY);
  ctx.scale(scale, scale);

  const nodeMap = new Map(graph.nodes.map((n) => [n.id, n]));

  // Рёбра
  for (const edge of graph.edges) {
    const src = nodeMap.get(edge.source);
    const dst = nodeMap.get(edge.target);
    if (!src || !dst) continue;

    const sx = src.x + GRAPH_NODE_WIDTH / 2;
    const sy = src.y + GRAPH_NODE_HEIGHT / 2;
    const tx = dst.x + GRAPH_NODE_WIDTH / 2;
    const ty = dst.y + GRAPH_NODE_HEIGHT / 2;
    const cx = (sx + tx) / 2;
    const cy = Math.min(sy, ty) - 28;

    ctx.save();
    ctx.strokeStyle = edge.isActiveAtCursor ? pal.accent : pal.border;
    ctx.lineWidth = edge.isActiveAtCursor ? 2.6 : 1.4;
    if (edge.kind === "spawn") ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.quadraticCurveTo(cx, cy, tx, ty);
    ctx.stroke();

    // Импульс сообщения на активном ребре
    if (edge.isActiveAtCursor) {
      const t = pulsePhase;
      const px = (1 - t) * (1 - t) * sx + 2 * (1 - t) * t * cx + t * t * tx;
      const py = (1 - t) * (1 - t) * sy + 2 * (1 - t) * t * cy + t * t * ty;
      ctx.fillStyle = pal.accent;
      ctx.beginPath();
      ctx.arc(px, py, 5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Бейдж ребра
    const mx = 0.25 * sx + 0.5 * cx + 0.25 * tx;
    const my = 0.25 * sy + 0.5 * cy + 0.25 * ty;
    ctx.font = "500 11px Inter, Segoe UI, sans-serif";
    const tw = ctx.measureText(edge.label).width + 12;
    drawRoundedRect(ctx, mx - tw / 2, my - 10, tw, 20, 6);
    ctx.fillStyle = pal.panel;
    ctx.fill();
    ctx.strokeStyle = edge.isActiveAtCursor ? pal.accent : pal.border;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = edge.isActiveAtCursor ? pal.accent : pal.textMuted;
    ctx.fillText(edge.label, mx - tw / 2 + 6, my + 4);
    ctx.restore();
  }

  // Узлы
  for (const node of graph.nodes) {
    drawRoundedRect(ctx, node.x, node.y, GRAPH_NODE_WIDTH, GRAPH_NODE_HEIGHT, 10);
    ctx.fillStyle = pal.panel;
    ctx.fill();
    ctx.strokeStyle = node.isActiveAtCursor ? pal.accent : pal.border;
    ctx.lineWidth = node.isActiveAtCursor ? 2 : 1;
    ctx.stroke();

    // Индикатор статуса
    ctx.fillStyle =
      node.status === "working" || node.status === "alive"
        ? pal.ok
        : node.status === "killed"
          ? "#ef4444"
          : pal.textMuted;
    ctx.beginPath();
    ctx.arc(node.x + 16, node.y + 22, 4.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = pal.textPrimary;
    ctx.font = "600 13px Inter, Segoe UI, sans-serif";
    ctx.fillText(node.label.slice(0, 20), node.x + 28, node.y + 26);

    ctx.fillStyle = pal.textMuted;
    ctx.font = "400 11px Inter, Segoe UI, sans-serif";
    ctx.fillText(`${node.subtitle} · ${node.sentCount} сообщ.`, node.x + 14, node.y + 52);
  }

  ctx.restore();

  // Нижняя строка текущего сообщения
  const currentMsg = detail.board.find((m) => m.seq === shownSeq) ?? detail.board[detail.board.length - 1];
  ctx.fillStyle = pal.panel;
  ctx.fillRect(0, height - 64, width, 64);
  ctx.strokeStyle = pal.border;
  ctx.beginPath();
  ctx.moveTo(0, height - 64);
  ctx.lineTo(width, height - 64);
  ctx.stroke();

  if (currentMsg) {
    const raw = currentMsg.text.replace(/\s+/g, " ").trim();
    const display = opts.autoTranslate ? opts.translatedMap[currentMsg.text.trim()] ?? raw : raw;
    ctx.fillStyle = pal.accent;
    ctx.font = "600 12px Inter, Segoe UI, sans-serif";
    ctx.fillText(`#${currentMsg.seq} @${currentMsg.agent}`, 20, height - 38);

    ctx.fillStyle = pal.textSecondary;
    ctx.font = "400 12px Inter, Segoe UI, sans-serif";
    ctx.fillText(display.slice(0, 118) + (display.length > 118 ? "…" : ""), 20, height - 18);
  }
}

export async function encodeReplayAsGifBlob(opts: ExportOptions): Promise<Uint8Array> {
  const width = 1280;
  const height = 720;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Не удалось создать 2D-контекст Canvas");

  const board = opts.detail.board;
  const seqSteps = board.length > 0 ? board.map((m) => m.seq) : [0];
  const subFrames = Math.max(2, Math.round(opts.fps * 0.45));
  const delayMs = Math.round(1000 / opts.fps);

  const gif = GIFEncoder();
  const total = seqSteps.length * subFrames;
  let done = 0;

  for (const seq of seqSteps) {
    for (let f = 0; f < subFrames; f++) {
      const pulse = f / Math.max(1, subFrames - 1);
      renderFrameToCanvas(ctx, width, height, opts.detail, seq === 0 ? null : seq, pulse, opts);
      const imageData = ctx.getImageData(0, 0, width, height);
      const palette = quantize(imageData.data, 128);
      const indexed = applyPalette(imageData.data, palette);
      gif.writeFrame(indexed, width, height, { palette, delay: delayMs });
      done += 1;
      opts.onProgress(Math.round((done / total) * 100), `Кодирование GIF: кадр ${done}/${total}`);
      if (done % 4 === 0) await new Promise((r) => setTimeout(r, 0));
    }
  }

  gif.finish();
  return gif.bytes();
}

export async function renderReplayFramesBase64(opts: ExportOptions): Promise<string[]> {
  const width = 1280;
  const height = 720;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Не удалось создать 2D-контекст Canvas");

  const board = opts.detail.board;
  const seqSteps = board.length > 0 ? board.map((m) => m.seq) : [0];
  const subFrames = Math.max(2, Math.round(opts.fps * 0.45));
  const total = seqSteps.length * subFrames;
  const frames: string[] = [];
  let done = 0;

  for (const seq of seqSteps) {
    for (let f = 0; f < subFrames; f++) {
      const pulse = f / Math.max(1, subFrames - 1);
      renderFrameToCanvas(ctx, width, height, opts.detail, seq === 0 ? null : seq, pulse, opts);
      frames.push(canvas.toDataURL("image/png"));
      done += 1;
      opts.onProgress(Math.round((done / total) * 75), `Рендер кадров: ${done}/${total}`);
      if (done % 4 === 0) await new Promise((r) => setTimeout(r, 0));
    }
  }
  return frames;
}

export async function encodeReplayAsWebmBase64(opts: ExportOptions): Promise<string> {
  const width = 1280;
  const height = 720;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Не удалось создать 2D-контекст Canvas");

  const stream = canvas.captureStream(opts.fps);
  const recorder = new MediaRecorder(stream, {
    mimeType: MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
      ? "video/webm;codecs=vp9"
      : "video/webm",
  });

  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  const finished = new Promise<Blob>((resolve) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: "video/webm" }));
  });

  recorder.start();

  const board = opts.detail.board;
  const seqSteps = board.length > 0 ? board.map((m) => m.seq) : [0];
  const subFrames = Math.max(3, Math.round(opts.fps * 0.5));
  const frameIntervalMs = Math.round(1000 / opts.fps);
  const total = seqSteps.length * subFrames;
  let done = 0;

  for (const seq of seqSteps) {
    for (let f = 0; f < subFrames; f++) {
      const pulse = f / Math.max(1, subFrames - 1);
      renderFrameToCanvas(ctx, width, height, opts.detail, seq === 0 ? null : seq, pulse, opts);
      done += 1;
      opts.onProgress(Math.round((done / total) * 90), `Запись WebM: ${done}/${total}`);
      await new Promise((r) => setTimeout(r, frameIntervalMs));
    }
  }

  recorder.stop();
  const blob = await finished;
  const buf = await blob.arrayBuffer();
  return uint8ToBase64(new Uint8Array(buf));
}

export function uint8ToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}
