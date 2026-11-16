import {
  Boxes,
  Command,
  Film,
  Languages,
  Minus,
  Moon,
  Plug,
  RefreshCw,
  Settings,
  Square,
  Sun,
  X,
  Zap,
} from "lucide-react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  closeWindow,
  minimizeWindow,
  startDraggingWindow,
  toggleMaximizeWindow,
} from "../lib/tauriBridge";
import type { SessionSummary, SettingsState } from "../types";

interface TopBarProps {
  activeSession: SessionSummary | null;
  settings: SettingsState;
  effectiveDark: boolean;
  autoTranslate: boolean;
  isTranslating: boolean;
  onToggleActiveOnly: () => void;
  onToggleCompactLayout?: () => void;
  onToggleTranslate: () => void;
  onCycleTheme: () => void;
  onOpenCommandPalette: () => void;
  onOpenConnectAgent?: () => void;
  onOpenExport: () => void;
  onOpenSettings: () => void;
  onRefresh: () => void;
}

export function TopBar({
  activeSession,
  settings,
  effectiveDark,
  autoTranslate,
  isTranslating,
  onToggleActiveOnly,
  onToggleCompactLayout,
  onToggleTranslate,
  onCycleTheme,
  onOpenCommandPalette,
  onOpenConnectAgent,
  onOpenExport,
  onOpenSettings,
  onRefresh,
}: TopBarProps) {
  const handleMinimize = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await minimizeWindow();
  };

  const handleMaximize = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await toggleMaximizeWindow();
  };

  const handleClose = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await closeWindow();
  };

  const handleDragStart = (e: React.PointerEvent | React.MouseEvent) => {
    if (e.button !== 0) return;

    const target = e.target as HTMLElement | null;
    if (
      target?.closest(
        "button, input, select, textarea, a, [role='button'], .no-drag",
      )
    ) {
      return;
    }

    try {
      getCurrentWindow().startDragging();
    } catch {
      startDraggingWindow().catch(() => {});
    }
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement | null;
    if (
      target?.closest(
        "button, input, select, textarea, a, [role='button'], .no-drag",
      )
    ) {
      return;
    }
    toggleMaximizeWindow().catch(() => {});
  };

  return (
    <header
      onPointerDown={handleDragStart}
      onMouseDown={handleDragStart}
      onDoubleClick={handleDoubleClick}
      className="h-11 shrink-0 flex items-center justify-between gap-3 px-3 border-b select-none cursor-default"
      style={{
        backgroundColor: "var(--bg-panel)",
        borderColor: "var(--border-subtle)",
      }}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex items-center gap-2 shrink-0 cursor-pointer">
          <span
            className="w-6 h-6 rounded-md flex items-center justify-center border shrink-0"
            style={{
              backgroundColor: "var(--accent-soft)",
              borderColor: "var(--border-strong)",
              color: "var(--accent)",
            }}
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
            >
              <circle cx="12" cy="5" r="2.5" />
              <circle cx="5" cy="19" r="2.5" />
              <circle cx="19" cy="19" r="2.5" />
              <path d="M10.8 7.2 6.2 16.8M13.2 7.2l4.6 9.6M7.5 19h9" />
            </svg>
          </span>
          <span
            className="text-xs font-bold tracking-tight"
            style={{ color: "var(--text-primary)" }}
          >
            SwarmGraph
          </span>
        </div>

        {activeSession && (
          <div
            className="flex items-center gap-2 min-w-0 pl-3 border-l"
            style={{ borderColor: "var(--border-subtle)" }}
          >
            <span
              className="text-xs font-medium truncate max-w-[200px]"
              style={{ color: "var(--text-secondary)" }}
              title={activeSession.title}
            >
              {activeSession.title}
            </span>
            <span
              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0 tabular-nums border"
              style={{
                borderColor: "var(--border-subtle)",
                backgroundColor: activeSession.is_live
                  ? "rgba(16, 185, 129, 0.12)"
                  : "var(--bg-elevated)",
                color: activeSession.is_live
                  ? "var(--status-ok)"
                  : "var(--text-muted)",
              }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{
                  backgroundColor: activeSession.is_live
                    ? "var(--status-ok)"
                    : "var(--text-muted)",
                }}
              />
              {activeSession.is_live ? "LIVE РОЙ" : "АРХИВ"}
            </span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 no-drag">
        <button
          type="button"
          onClick={onOpenCommandPalette}
          className="hidden md:flex items-center justify-between gap-3 h-7 px-2.5 rounded-lg border text-xs transition-colors cursor-pointer min-w-[220px] max-w-[320px]"
          style={{
            backgroundColor: "var(--bg-elevated)",
            borderColor: "var(--border-subtle)",
            color: "var(--text-muted)",
          }}
        >
          <span className="flex items-center gap-2 truncate">
            <Command className="w-3.5 h-3.5 shrink-0" strokeWidth={1.5} />
            <span className="truncate">Поиск агентов и сообщений</span>
          </span>
          <kbd
            className="px-1 py-0.2 rounded text-[10px] font-medium border shrink-0 tabular-nums"
            style={{
              borderColor: "var(--border-subtle)",
              backgroundColor: "var(--bg-panel)",
              color: "var(--text-muted)",
            }}
          >
            Ctrl K
          </kbd>
        </button>

        <button
          type="button"
          onClick={onToggleActiveOnly}
          title={
            settings.onlyActiveWork
              ? "Показываются только активные работы (кликните, чтобы показать всех)"
              : "Показать только активные работы и задачи роя"
          }
          className="h-7 px-2.5 rounded-lg border text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap"
          style={{
            backgroundColor: settings.onlyActiveWork
              ? "var(--accent-soft)"
              : "var(--bg-elevated)",
            borderColor: settings.onlyActiveWork
              ? "var(--accent)"
              : "var(--border-subtle)",
            color: settings.onlyActiveWork
              ? "var(--accent)"
              : "var(--text-secondary)",
          }}
        >
          <Zap
            className="w-3.5 h-3.5 shrink-0"
            strokeWidth={settings.onlyActiveWork ? 2.2 : 1.6}
          />
          <span>Только активные</span>
          {settings.onlyActiveWork && (
            <span
              className="w-1.5 h-1.5 rounded-full animate-pulse"
              style={{ backgroundColor: "var(--accent)" }}
            />
          )}
        </button>

        <button
          type="button"
          onClick={onToggleCompactLayout}
          title={
            settings.compactLayout
              ? "Компактная группировка активна (кликните, чтобы развернуть)"
              : "Собрать всех субагентов и участников роя компактно"
          }
          className="h-7 px-2.5 rounded-lg border text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap"
          style={{
            backgroundColor: settings.compactLayout
              ? "var(--accent-soft)"
              : "var(--bg-elevated)",
            borderColor: settings.compactLayout
              ? "var(--accent)"
              : "var(--border-subtle)",
            color: settings.compactLayout
              ? "var(--accent)"
              : "var(--text-secondary)",
          }}
        >
          <Boxes
            className="w-3.5 h-3.5 shrink-0"
            strokeWidth={settings.compactLayout ? 2.2 : 1.6}
          />
          <span>Компактно</span>
          {settings.compactLayout && (
            <span
              className="w-1.5 h-1.5 rounded-full animate-pulse"
              style={{ backgroundColor: "var(--accent)" }}
            />
          )}
        </button>
      </div>

      <div className="flex items-center gap-1.5 shrink-0 no-drag">
        <button
          type="button"
          onClick={onToggleTranslate}
          title="Автоперевод английских промптов и сообщений на русский"
          className="h-7 px-2 rounded-lg border text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer shrink-0"
          style={{
            backgroundColor: autoTranslate
              ? "var(--accent-soft)"
              : "var(--bg-elevated)",
            borderColor: autoTranslate
              ? "var(--accent)"
              : "var(--border-subtle)",
            color: autoTranslate ? "var(--accent)" : "var(--text-secondary)",
          }}
        >
          <Languages className="w-3.5 h-3.5 shrink-0" strokeWidth={1.5} />
          <span className="hidden sm:inline">
            {isTranslating ? "Перевод..." : "RU"}
          </span>
        </button>

        <button
          type="button"
          onClick={onRefresh}
          title="Обновить список сессий"
          className="w-7 h-7 rounded-lg border flex items-center justify-center transition-colors cursor-pointer"
          style={{
            backgroundColor: "var(--bg-elevated)",
            borderColor: "var(--border-subtle)",
            color: "var(--text-secondary)",
          }}
        >
          <RefreshCw className="w-3.5 h-3.5" strokeWidth={1.5} />
        </button>

        <button
          type="button"
          onClick={onCycleTheme}
          title={
            effectiveDark
              ? "Переключить на светлую тему"
              : "Переключить на тёмную тему"
          }
          className="w-7 h-7 rounded-lg border flex items-center justify-center transition-colors cursor-pointer"
          style={{
            backgroundColor: "var(--bg-elevated)",
            borderColor: "var(--border-subtle)",
            color: "var(--text-secondary)",
          }}
        >
          {effectiveDark ? (
            <Sun className="w-3.5 h-3.5" strokeWidth={1.5} />
          ) : (
            <Moon className="w-3.5 h-3.5" strokeWidth={1.5} />
          )}
        </button>

        <button
          type="button"
          onClick={onOpenConnectAgent}
          title="Подключить внешнего агента к SwarmGraph (Claude Code, Codex, Custom)"
          className="h-7 px-2.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shrink-0"
          style={{
            backgroundColor: "var(--accent-soft)",
            borderColor: "var(--accent)",
            color: "var(--accent)",
          }}
        >
          <Plug className="w-3.5 h-3.5 shrink-0" strokeWidth={1.8} />
          <span className="hidden sm:inline">Подключить агента</span>
        </button>

        <button
          type="button"
          onClick={onOpenExport}
          disabled={!activeSession}
          className="h-7 px-2.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-opacity cursor-pointer disabled:opacity-40"
          style={{
            backgroundColor: "var(--accent)",
            color: "var(--accent-fg)",
          }}
        >
          <Film className="w-3.5 h-3.5 shrink-0" strokeWidth={1.6} />
          <span className="hidden lg:inline">Экспорт</span>
        </button>

        <button
          type="button"
          onClick={onOpenSettings}
          title="Меню настроек оформления и динамики роя"
          className="w-7 h-7 rounded-lg border flex items-center justify-center transition-colors cursor-pointer"
          style={{
            backgroundColor: "var(--bg-elevated)",
            borderColor: "var(--border-subtle)",
            color: "var(--text-secondary)",
          }}
        >
          <Settings className="w-3.5 h-3.5" strokeWidth={1.6} />
        </button>

        <div
          className="w-px h-4 mx-1"
          style={{ backgroundColor: "var(--border-subtle)" }}
        />

        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={handleMinimize}
            title="Свернуть окно"
            className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-white/10 transition-colors cursor-pointer"
            style={{ color: "var(--text-secondary)" }}
          >
            <Minus className="w-3.5 h-3.5" strokeWidth={1.8} />
          </button>

          <button
            type="button"
            onClick={handleMaximize}
            title="Развернуть / восстановить"
            className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-white/10 transition-colors cursor-pointer"
            style={{ color: "var(--text-secondary)" }}
          >
            <Square className="w-3 h-3" strokeWidth={1.8} />
          </button>

          <button
            type="button"
            onClick={handleClose}
            title="Закрыть окно"
            className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-red-500 hover:text-white transition-colors cursor-pointer"
            style={{ color: "var(--text-secondary)" }}
          >
            <X className="w-3.5 h-3.5" strokeWidth={1.8} />
          </button>
        </div>
      </div>
    </header>
  );
}
