import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Film, X } from "lucide-react";
import {
  encodeReplayAsGifBlob,
  encodeReplayAsWebmBase64,
  renderReplayFramesBase64,
  uint8ToBase64,
} from "../lib/canvasExport";
import {
  checkFfmpeg,
  exportFramesFfmpeg,
  pickExportFile,
  saveExportBinary,
} from "../lib/tauriBridge";
import type { SessionDetail, StylePreset } from "../types";

interface ExportModalProps {
  open: boolean;
  detail: SessionDetail | null;
  activeChannel: string;
  customPositions: Record<string, { x: number; y: number }>;
  preset: StylePreset;
  isDark: boolean;
  autoTranslate: boolean;
  translatedMap: Record<string, string>;
  onClose: () => void;
}

export function ExportModal({
  open,
  detail,
  activeChannel,
  customPositions,
  preset,
  isDark,
  autoTranslate,
  translatedMap,
  onClose,
}: ExportModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [format, setFormat] = useState<"gif" | "mp4" | "webm">("gif");
  const [fps, setFps] = useState(12);
  const [hasFfmpeg, setHasFfmpeg] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState("");
  const [savedPath, setSavedPath] = useState<string | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open) {
      setSavedPath(null);
      setErrorText(null);
      setProgress(0);
      setStatusText("");
      checkFfmpeg().then(setHasFfmpeg).catch(() => setHasFfmpeg(false));
      if (!dialog.open) dialog.showModal();
    } else if (dialog.open) {
      dialog.close();
    }
  }, [open]);

  const handleClose = () => {
    if (isExporting) return;
    const dialog = dialogRef.current;
    if (dialog) dialog.returnValue = "";
    onClose();
  };

  const startExport = async () => {
    if (!detail) return;
    setErrorText(null);
    setSavedPath(null);

    const safeName = (detail.summary.title || "swarm-graph")
      .replace(/[\\/:*?"<>|]/g, "_")
      .slice(0, 48);
    const outPath = await pickExportFile(`${safeName}.${format}`, format);
    if (!outPath) return;

    setIsExporting(true);
    try {
      const opts = {
        detail,
        activeChannel,
        customPositions,
        preset,
        isDark,
        fps,
        format,
        translatedMap,
        autoTranslate,
        onProgress: (p: number, label: string) => {
          setProgress(p);
          setStatusText(label);
        },
      };

      if (format === "mp4") {
        if (!hasFfmpeg) {
          throw new Error("Для экспорта в MP4 требуется FFmpeg. Выберите GIF или WebM.");
        }
        const frames = await renderReplayFramesBase64(opts);
        setProgress(85);
        setStatusText("Сборка видео MP4 (H.264) через FFmpeg...");
        await exportFramesFfmpeg(frames, fps, outPath, "mp4");
      } else if (format === "gif") {
        if (hasFfmpeg) {
          const frames = await renderReplayFramesBase64(opts);
          setProgress(85);
          setStatusText("Оптимизация палитры GIF через FFmpeg...");
          await exportFramesFfmpeg(frames, fps, outPath, "gif");
        } else {
          const bytes = await encodeReplayAsGifBlob(opts);
          setProgress(95);
          setStatusText("Сохранение GIF на диск...");
          await saveExportBinary(outPath, uint8ToBase64(bytes));
        }
      } else {
        const b64 = await encodeReplayAsWebmBase64(opts);
        setProgress(95);
        setStatusText("Сохранение WebM на диск...");
        await saveExportBinary(outPath, b64);
      }

      setProgress(100);
      setStatusText("Экспорт завершён");
      setSavedPath(outPath);
    } catch (err) {
      setErrorText(err instanceof Error ? err.message : String(err));
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <dialog
      ref={dialogRef}
      closedby={isExporting ? "none" : "any"}
      aria-labelledby="export-modal-title"
      onClose={handleClose}
      className="m-auto w-full max-w-md rounded-2xl shadow-2xl overflow-hidden"
    >
      <div
        className="px-5 py-4 border-b flex items-center justify-between"
        style={{ borderColor: "var(--border-subtle)" }}
      >
        <div className="flex items-center gap-2">
          <Film className="w-4 h-4" strokeWidth={1.6} style={{ color: "var(--accent)" }} />
          <h2 id="export-modal-title" className="text-sm font-semibold">
            Экспорт хронологии графа
          </h2>
        </div>
        <button
          type="button"
          onClick={handleClose}
          disabled={isExporting}
          aria-label="Закрыть окно экспорта"
          className="w-7 h-7 rounded-md flex items-center justify-center cursor-pointer disabled:opacity-40"
          style={{ color: "var(--text-muted)" }}
        >
          <X className="w-4 h-4" strokeWidth={1.5} />
        </button>
      </div>

      <div className="p-5 space-y-4">
        <div className="space-y-2">
          <div className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
            Формат файла
          </div>
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                { id: "gif", title: "GIF", desc: "Анимация" },
                { id: "mp4", title: "MP4", desc: hasFfmpeg ? "H.264 HD" : "Нужен FFmpeg" },
                { id: "webm", title: "WebM", desc: "Браузерное видео" },
              ] as const
            ).map((opt) => {
              const active = format === opt.id;
              const disabled = opt.id === "mp4" && !hasFfmpeg;
              return (
                <button
                  key={opt.id}
                  type="button"
                  disabled={disabled || isExporting}
                  onClick={() => setFormat(opt.id)}
                  className="p-2.5 rounded-xl border text-left transition-colors cursor-pointer disabled:opacity-40"
                  style={{
                    backgroundColor: active ? "var(--accent-soft)" : "var(--bg-elevated)",
                    borderColor: active ? "var(--accent)" : "var(--border-subtle)",
                  }}
                >
                  <div className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>
                    {opt.title}
                  </div>
                  <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                    {opt.desc}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium" style={{ color: "var(--text-secondary)" }}>
              Частота кадров (FPS)
            </span>
            <span className="tabular-nums font-medium" style={{ color: "var(--text-primary)" }}>
              {fps} кадров/с
            </span>
          </div>
          <input
            type="range"
            min={6}
            max={30}
            step={2}
            value={fps}
            disabled={isExporting}
            onChange={(e) => setFps(Number(e.target.value))}
            className="w-full accent-[var(--accent)] cursor-pointer"
          />
        </div>

        {(isExporting || progress > 0) && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span style={{ color: "var(--text-secondary)" }}>{statusText}</span>
              <span className="tabular-nums font-medium" style={{ color: "var(--text-primary)" }}>
                {progress}%
              </span>
            </div>
            <div
              className="h-2 rounded-full overflow-hidden"
              style={{ backgroundColor: "var(--bg-elevated)" }}
            >
              <div
                className="h-full transition-all"
                style={{
                  width: `${progress}%`,
                  backgroundColor: "var(--accent)",
                }}
              />
            </div>
          </div>
        )}

        {savedPath && (
          <div
            className="p-3 rounded-xl border flex items-start gap-2 text-xs"
            style={{
              backgroundColor: "rgba(16, 185, 129, 0.1)",
              borderColor: "var(--status-ok)",
              color: "var(--status-ok)",
            }}
          >
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" strokeWidth={1.6} />
            <div className="min-w-0 break-all">Сохранено: {savedPath}</div>
          </div>
        )}

        {errorText && (
          <div
            className="p-3 rounded-xl border text-xs"
            style={{
              backgroundColor: "rgba(239, 68, 68, 0.1)",
              borderColor: "var(--status-danger)",
              color: "var(--status-danger)",
            }}
          >
            {errorText}
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={handleClose}
            disabled={isExporting}
            className="h-9 px-3.5 rounded-lg border text-xs font-medium cursor-pointer disabled:opacity-40"
            style={{
              backgroundColor: "var(--bg-elevated)",
              borderColor: "var(--border-subtle)",
              color: "var(--text-secondary)",
            }}
          >
            Закрыть
          </button>
          <button
            type="button"
            onClick={startExport}
            disabled={isExporting || !detail}
            className="h-9 px-4 rounded-lg text-xs font-medium cursor-pointer disabled:opacity-40"
            style={{
              backgroundColor: "var(--accent)",
              color: "var(--accent-fg)",
            }}
          >
            {isExporting ? "Экспортирую..." : `Сохранить ${format.toUpperCase()}`}
          </button>
        </div>
      </div>
    </dialog>
  );
}
