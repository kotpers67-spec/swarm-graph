import { useEffect, useRef, useState } from "react";
import { Film, Languages, Palette, Search, Settings, SunMoon, X } from "lucide-react";
import type { GraphNode, SessionSummary, StylePreset } from "../types";

interface CommandPaletteProps {
  open: boolean;
  sessions: SessionSummary[];
  graphNodes: GraphNode[];
  onClose: () => void;
  onSelectSession: (id: string) => void;
  onSelectNode: (id: string) => void;
  onSelectPreset: (preset: StylePreset) => void;
  onToggleTheme: () => void;
  onToggleTranslate: () => void;
  onOpenExport: () => void;
  onOpenSettings?: () => void;
}

export function CommandPalette({
  open,
  sessions,
  graphNodes,
  onClose,
  onSelectSession,
  onSelectNode,
  onSelectPreset,
  onToggleTheme,
  onToggleTranslate,
  onOpenExport,
  onOpenSettings,
}: CommandPaletteProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [query, setQuery] = useState("");
  const pressedOutsideRef = useRef(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open) {
      setQuery("");
      if (!dialog.open) dialog.showModal();
    } else if (dialog.open) {
      dialog.close();
    }
  }, [open]);

  const handleClose = () => {
    const dialog = dialogRef.current;
    if (dialog) dialog.returnValue = "";
    onClose();
  };

  const q = query.trim().toLowerCase();

  const actions = [
    {
      id: "theme",
      label: "Переключить светлую / тёмную тему",
      icon: SunMoon,
      run: () => {
        onToggleTheme();
        handleClose();
      },
    },
    {
      id: "settings",
      label: "Настройки оформления, 6 шрифтов и динамики роя",
      icon: Settings,
      run: () => {
        handleClose();
        onOpenSettings?.();
      },
    },
    {
      id: "translate",
      label: "Включить / выключить автоперевод EN → RU",
      icon: Languages,
      run: () => {
        onToggleTranslate();
        handleClose();
      },
    },
    {
      id: "export",
      label: "Экспортировать граф и хронологию в GIF / Видео",
      icon: Film,
      run: () => {
        handleClose();
        onOpenExport();
      },
    },
    {
      id: "preset-graphite",
      label: "Стиль: Linear Graphite",
      icon: Palette,
      run: () => {
        onSelectPreset("graphite");
        handleClose();
      },
    },
    {
      id: "preset-obsidian",
      label: "Стиль: Raycast Obsidian",
      icon: Palette,
      run: () => {
        onSelectPreset("obsidian");
        handleClose();
      },
    },
    {
      id: "preset-blueprint",
      label: "Стиль: Cursor Blueprint",
      icon: Palette,
      run: () => {
        onSelectPreset("blueprint");
        handleClose();
      },
    },
  ].filter((a) => !q || a.label.toLowerCase().includes(q));

  const matchedNodes = graphNodes.filter(
    (n) => !q || n.label.toLowerCase().includes(q) || n.subtitle.toLowerCase().includes(q),
  );

  const matchedSessions = sessions.filter(
    (s) => !q || s.title.toLowerCase().includes(q) || s.id.toLowerCase().includes(q),
  );

  return (
    <dialog
      ref={dialogRef}
      closedby="any"
      aria-labelledby="cmd-palette-title"
      onClose={handleClose}
      onPointerDown={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        pressedOutsideRef.current =
          e.clientX < rect.left ||
          e.clientX > rect.right ||
          e.clientY < rect.top ||
          e.clientY > rect.bottom;
      }}
      onPointerUp={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const outside =
          e.clientX < rect.left ||
          e.clientX > rect.right ||
          e.clientY < rect.top ||
          e.clientY > rect.bottom;
        if (pressedOutsideRef.current && outside) handleClose();
      }}
      className="m-auto w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden"
    >
      <div className="flex items-center gap-2.5 px-4 h-12 border-b" style={{ borderColor: "var(--border-subtle)" }}>
        <Search className="w-4 h-4 shrink-0" strokeWidth={1.5} style={{ color: "var(--text-muted)" }} />
        <h2 id="cmd-palette-title" className="sr-only">
          Палитра команд SwarmGraph
        </h2>
        <input
          type="text"
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Перейти к агенту, сессии или команде..."
          className="flex-1 min-w-0 bg-transparent text-sm outline-none"
          style={{ color: "var(--text-primary)" }}
        />
        <button
          type="button"
          onClick={handleClose}
          aria-label="Закрыть палитру команд"
          className="w-7 h-7 rounded-md flex items-center justify-center cursor-pointer"
          style={{ color: "var(--text-muted)" }}
        >
          <X className="w-4 h-4" strokeWidth={1.5} />
        </button>
      </div>

      <div className="max-h-96 overflow-y-auto scroller p-2 space-y-3">
        {actions.length > 0 && (
          <div>
            <div className="px-2 py-1 text-[11px] font-medium" style={{ color: "var(--text-muted)" }}>
              Быстрые действия
            </div>
            {actions.map((act) => {
              const Icon = act.icon;
              return (
                <button
                  key={act.id}
                  type="button"
                  onClick={act.run}
                  className="w-full text-left px-2.5 py-2 rounded-lg text-xs flex items-center gap-2.5 hover:bg-white/5 cursor-pointer"
                  style={{ color: "var(--text-primary)" }}
                >
                  <Icon className="w-4 h-4 shrink-0" strokeWidth={1.5} style={{ color: "var(--accent)" }} />
                  <span className="truncate">{act.label}</span>
                </button>
              );
            })}
          </div>
        )}

        {matchedNodes.length > 0 && (
          <div>
            <div className="px-2 py-1 text-[11px] font-medium" style={{ color: "var(--text-muted)" }}>
              Агенты текущего графа
            </div>
            {matchedNodes.slice(0, 8).map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => {
                  onSelectNode(n.id);
                  handleClose();
                }}
                className="w-full text-left px-2.5 py-2 rounded-lg text-xs flex items-center justify-between gap-2 hover:bg-white/5 cursor-pointer"
                style={{ color: "var(--text-secondary)" }}
              >
                <span className="truncate font-medium">@{n.label}</span>
                <span className="text-[11px] shrink-0" style={{ color: "var(--text-muted)" }}>
                  {n.subtitle}
                </span>
              </button>
            ))}
          </div>
        )}

        {matchedSessions.length > 0 && (
          <div>
            <div className="px-2 py-1 text-[11px] font-medium" style={{ color: "var(--text-muted)" }}>
              Сессии и рои
            </div>
            {matchedSessions.slice(0, 8).map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  onSelectSession(s.id);
                  handleClose();
                }}
                className="w-full text-left px-2.5 py-2 rounded-lg text-xs flex items-center justify-between gap-2 hover:bg-white/5 cursor-pointer"
                style={{ color: "var(--text-secondary)" }}
              >
                <span className="truncate">{s.title}</span>
                <span className="text-[11px] shrink-0 tabular-nums" style={{ color: "var(--text-muted)" }}>
                  {s.member_count} уч.
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </dialog>
  );
}
