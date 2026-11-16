import { useEffect, useRef } from "react";
import {
  Check,
  FolderOpen,
  Moon,
  Palette,
  Plus,
  Sparkles,
  Sun,
  Trash2,
  Type,
  X,
} from "lucide-react";
import { pickBrainDirectory } from "../lib/tauriBridge";
import type {
  AgentPlatform,
  AnimationSpeed,
  FontFamilyPreset,
  GridStyle,
  SettingsState,
  StylePreset,
  ThemeMode,
} from "../types";

interface SettingsModalProps {
  open: boolean;
  settings: SettingsState;
  onUpdateSettings: (updater: (prev: SettingsState) => SettingsState) => void;
  onChangeBrainDir: () => void;
  onClose: () => void;
}

const PRESETS: { id: StylePreset; label: string; desc: string }[] = [
  { id: "graphite", label: "Graphite", desc: "Строгий нейтральный стиль (Linear)" },
  { id: "obsidian", label: "Obsidian", desc: "Глубокий чёрный контраст (Raycast)" },
  { id: "blueprint", label: "Blueprint", desc: "Инженерная техническая сетка" },
  { id: "midnight", label: "Midnight", desc: "Ультратёмный ночной сапфир" },
];

const THEMES: { id: ThemeMode; label: string; icon: typeof Sun }[] = [
  { id: "system", label: "Системная", icon: Sparkles },
  { id: "dark", label: "Тёмная", icon: Moon },
  { id: "light", label: "Светлая", icon: Sun },
];

const FONTS: { id: FontFamilyPreset; label: string; desc: string; sample: string }[] = [
  { id: "geist", label: "Geist / Inter", desc: "Современный гротеск", sample: "Ag 123" },
  { id: "segoe", label: "Segoe UI", desc: "Системный Fluent", sample: "Ag 123" },
  { id: "jetbrains", label: "JetBrains Mono", desc: "Моноширинный", sample: "0x12F" },
  { id: "outfit", label: "Outfit", desc: "Геометрический", sample: "Ag 123" },
  { id: "ibm-plex", label: "IBM Plex Sans", desc: "Швейцарский стиль", sample: "Ag 123" },
  { id: "fira-code", label: "Fira Code", desc: "Код с лигатурами", sample: "=> !==" },
];

const GRIDS: { id: GridStyle; label: string }[] = [
  { id: "dots", label: "Точки" },
  { id: "blueprint", label: "Инженерная сетка" },
  { id: "minimal", label: "Без сетки" },
];

const SPEEDS: { id: AnimationSpeed; label: string; desc: string }[] = [
  { id: "fast", label: "Быстрая", desc: "1.0 с" },
  { id: "smooth", label: "Плавная", desc: "1.6 с" },
  { id: "cinematic", label: "Кинематографичная", desc: "2.6 с" },
];

const PLATFORMS: {
  id: AgentPlatform;
  label: string;
  desc: string;
  badge: string;
  badgeColor: string;
}[] = [
  {
    id: "antigravity",
    label: "Google Antigravity",
    desc: "Локальный рой и сессии агентов из каталога brain",
    badge: "Antigravity",
    badgeColor: "var(--accent)",
  },
  {
    id: "claude_code",
    label: "Claude Code",
    desc: "Сессии CLI-агентов Anthropic (~/.claude/projects)",
    badge: "Claude Code",
    badgeColor: "#f59e0b",
  },
  {
    id: "codex",
    label: "OpenAI Codex",
    desc: "Контексты и вызовы Codex CLI (~/.codex/sessions)",
    badge: "Codex",
    badgeColor: "#10b981",
  },
  {
    id: "custom",
    label: "Кастомные агенты",
    desc: "Пользовательские каталоги с протоколом board.jsonl",
    badge: "Кастомный",
    badgeColor: "#8b5cf6",
  },
];

interface ToggleRowProps {
  label: string;
  desc: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

function ToggleRow({ label, desc, checked, onChange }: ToggleRowProps) {
  return (
    <label
      className="flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer select-none group"
      style={{
        backgroundColor: checked ? "var(--bg-panel)" : "var(--bg-elevated)",
        borderColor: checked ? "var(--accent)" : "var(--border-subtle)",
      }}
    >
      <div className="pr-3">
        <span
          className="font-semibold text-xs block transition-colors"
          style={{ color: checked ? "var(--accent)" : "var(--text-primary)" }}
        >
          {label}
        </span>
        <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
          {desc}
        </span>
      </div>
      <div className="relative inline-flex items-center shrink-0">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only"
        />
        <div
          className="w-11 h-6 rounded-full transition-colors relative flex items-center px-0.5"
          style={{
            backgroundColor: checked
              ? "var(--accent)"
              : "rgba(128, 128, 128, 0.28)",
          }}
        >
          <div
            className="w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200 ease-in-out"
            style={{
              transform: checked ? "translateX(20px)" : "translateX(0px)",
            }}
          />
        </div>
      </div>
    </label>
  );
}

export function SettingsModal({
  open,
  settings,
  onUpdateSettings,
  onChangeBrainDir,
  onClose,
}: SettingsModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  const enabledPlatforms = settings.enabledPlatforms ?? [
    "antigravity",
    "claude_code",
    "codex",
    "custom",
  ];

  const handleTogglePlatform = (platformId: AgentPlatform) => {
    onUpdateSettings((prev) => {
      const list = prev.enabledPlatforms ?? [
        "antigravity",
        "claude_code",
        "codex",
        "custom",
      ];
      const next = list.includes(platformId)
        ? list.filter((p) => p !== platformId)
        : [...list, platformId];
      return { ...prev, enabledPlatforms: next };
    });
  };

  const handleAddCustomPath = async () => {
    const dir = await pickBrainDirectory();
    if (!dir) return;
    const name = dir.split(/[\\/]/).filter(Boolean).pop() || "Кастомный агент";
    onUpdateSettings((prev) => {
      const sources = prev.customSources ?? [];
      const exists = sources.some((s) => s.path === dir);
      if (exists) return prev;
      return {
        ...prev,
        customSources: [
          ...sources,
          { id: `src-${Date.now()}`, name, path: dir, enabled: true },
        ],
        enabledPlatforms: prev.enabledPlatforms?.includes("custom")
          ? prev.enabledPlatforms
          : [...(prev.enabledPlatforms ?? []), "custom"],
      };
    });
  };

  const handleRemoveCustomSource = (id: string) => {
    onUpdateSettings((prev) => ({
      ...prev,
      customSources: (prev.customSources ?? []).filter((s) => s.id !== id),
    }));
  };

  const handleRenameCustomSource = (id: string, name: string) => {
    onUpdateSettings((prev) => ({
      ...prev,
      customSources: (prev.customSources ?? []).map((s) =>
        s.id === id ? { ...s, name } : s,
      ),
    }));
  };

  const handleToggleCustomSource = (id: string, enabled: boolean) => {
    onUpdateSettings((prev) => ({
      ...prev,
      customSources: (prev.customSources ?? []).map((s) =>
        s.id === id ? { ...s, enabled } : s,
      ),
    }));
  };

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const handleCancel = (e: Event) => {
      e.preventDefault();
      onClose();
    };
    dialog.addEventListener("cancel", handleCancel);
    return () => dialog.removeEventListener("cancel", handleCancel);
  }, [onClose]);

  if (!open) return null;

  return (
    <dialog
      ref={dialogRef}
      onClick={(e) => {
        if (e.target === dialogRef.current) onClose();
      }}
      className="backdrop:bg-black/60 backdrop:backdrop-blur-sm bg-transparent p-0 m-auto border-0 max-w-xl w-full select-none"
    >
      <div
        className="rounded-2xl border shadow-2xl overflow-hidden flex flex-col text-sm max-h-[85vh]"
        style={{
          backgroundColor: "var(--bg-panel)",
          borderColor: "var(--border-subtle)",
          color: "var(--text-primary)",
        }}
      >
        <div
          className="h-14 px-5 border-b flex items-center justify-between shrink-0"
          style={{ borderColor: "var(--border-subtle)" }}
        >
          <div className="flex items-center gap-2.5">
            <span
              className="w-7 h-7 rounded-lg flex items-center justify-center border"
              style={{
                backgroundColor: "var(--accent-soft)",
                borderColor: "var(--border-strong)",
                color: "var(--accent)",
              }}
            >
              <Palette className="w-4 h-4" strokeWidth={1.7} />
            </span>
            <div>
              <h2 className="text-sm font-semibold tracking-tight">Настройки SwarmGraph</h2>
              <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                Оформление, динамика агентов, фильтры и интеграции
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center border transition-colors cursor-pointer"
            style={{
              backgroundColor: "var(--bg-elevated)",
              borderColor: "var(--border-subtle)",
              color: "var(--text-secondary)",
            }}
          >
            <X className="w-4 h-4" strokeWidth={1.6} />
          </button>
        </div>

        <div className="p-5 space-y-5 overflow-y-auto min-h-0">
          <section className="space-y-2">
            <label className="text-xs font-semibold block" style={{ color: "var(--text-secondary)" }}>
              Стиль оформления
            </label>
            <div className="grid grid-cols-2 gap-2">
              {PRESETS.map((p) => {
                const active = settings.preset === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => onUpdateSettings((s) => ({ ...s, preset: p.id }))}
                    className="p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col gap-1"
                    style={{
                      backgroundColor: active ? "var(--accent-soft)" : "var(--bg-elevated)",
                      borderColor: active ? "var(--accent)" : "var(--border-subtle)",
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-xs" style={{ color: active ? "var(--accent)" : "var(--text-primary)" }}>
                        {p.label}
                      </span>
                      {active && (
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: "var(--accent)" }} />
                      )}
                    </div>
                    <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                      {p.desc}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="space-y-2">
            <label className="text-xs font-semibold block" style={{ color: "var(--text-secondary)" }}>
              Тема интерфейса
            </label>
            <div className="grid grid-cols-3 gap-2">
              {THEMES.map((t) => {
                const active = settings.theme === t.id;
                const Icon = t.icon;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => onUpdateSettings((s) => ({ ...s, theme: t.id }))}
                    className="h-9 px-3 rounded-xl border flex items-center justify-center gap-2 text-xs font-medium transition-all cursor-pointer"
                    style={{
                      backgroundColor: active ? "var(--accent-soft)" : "var(--bg-elevated)",
                      borderColor: active ? "var(--accent)" : "var(--border-subtle)",
                      color: active ? "var(--accent)" : "var(--text-secondary)",
                    }}
                  >
                    <Icon className="w-3.5 h-3.5" strokeWidth={1.6} />
                    <span>{t.label}</span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="space-y-2 pt-2 border-t" style={{ borderColor: "var(--border-subtle)" }}>
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold flex items-center gap-1.5" style={{ color: "var(--text-secondary)" }}>
                <Type className="w-3.5 h-3.5" strokeWidth={1.6} />
                <span>Шрифт интерфейса</span>
              </label>
              <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                6 премиальных начертаний
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {FONTS.map((f) => {
                const active = (settings.fontFamily ?? "geist") === f.id;
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => onUpdateSettings((s) => ({ ...s, fontFamily: f.id }))}
                    className="p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col gap-1 min-w-0"
                    style={{
                      backgroundColor: active ? "var(--accent-soft)" : "var(--bg-elevated)",
                      borderColor: active ? "var(--accent)" : "var(--border-subtle)",
                    }}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span
                        className="font-semibold text-xs truncate"
                        style={{ color: active ? "var(--accent)" : "var(--text-primary)" }}
                      >
                        {f.label}
                      </span>
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded border shrink-0"
                        style={{
                          backgroundColor: "var(--bg-panel)",
                          borderColor: "var(--border-subtle)",
                          color: "var(--text-muted)",
                          fontFamily:
                            f.id === "jetbrains"
                              ? '"JetBrains Mono", monospace'
                              : f.id === "fira-code"
                                ? '"Fira Code", monospace'
                                : f.id === "outfit"
                                  ? '"Outfit", sans-serif'
                                  : f.id === "ibm-plex"
                                    ? '"IBM Plex Sans", sans-serif'
                                    : f.id === "segoe"
                                      ? '"Segoe UI", sans-serif'
                                      : '"Inter", sans-serif',
                        }}
                      >
                        {f.sample}
                      </span>
                    </div>
                    <span className="text-[11px] truncate" style={{ color: "var(--text-muted)" }}>
                      {f.desc}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="space-y-2.5 pt-2 border-t" style={{ borderColor: "var(--border-subtle)" }}>
            <label className="text-xs font-semibold block" style={{ color: "var(--text-secondary)" }}>
              Динамика агентов и фильтрация
            </label>

            <ToggleRow
              label="Появление только после старта"
              desc="Агент отображается на холсте только когда ему назначен промпт или запущена задача"
              checked={settings.appearOnStartOnly}
              onChange={(val) =>
                onUpdateSettings((s) => ({ ...s, appearOnStartOnly: val }))
              }
            />

            <ToggleRow
              label="Подсветка цепочки задач"
              desc="Отображать бейджи «← от @...» и «→ к @...» на карточках агентов"
              checked={settings.highlightHandoffChain}
              onChange={(val) =>
                onUpdateSettings((s) => ({ ...s, highlightHandoffChain: val }))
              }
            />

            <ToggleRow
              label="⚡ Только активные работы"
              desc="Скрыть завершённых и ожидающих агентов, показывая только тех, кто в работе прямо сейчас"
              checked={settings.onlyActiveWork}
              onChange={(val) =>
                onUpdateSettings((s) => ({ ...s, onlyActiveWork: val }))
              }
            />

            <ToggleRow
              label="Автоперевод на русский язык (RU)"
              desc="Автоматический фоновый перевод английских сообщений, брифов и промптов"
              checked={settings.autoTranslate}
              onChange={(val) =>
                onUpdateSettings((s) => ({ ...s, autoTranslate: val }))
              }
            />

            <div className="space-y-1.5 pt-1">
              <label className="text-[11px] font-medium" style={{ color: "var(--text-muted)" }}>
                Скорость пульсирующих волн передачи задач
              </label>
              <div className="grid grid-cols-3 gap-2">
                {SPEEDS.map((sp) => {
                  const active = settings.animationSpeed === sp.id;
                  return (
                    <button
                      key={sp.id}
                      type="button"
                      onClick={() =>
                        onUpdateSettings((s) => ({ ...s, animationSpeed: sp.id }))
                      }
                      className="h-8 px-2 rounded-lg border text-xs font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                      style={{
                        backgroundColor: active ? "var(--accent-soft)" : "var(--bg-elevated)",
                        borderColor: active ? "var(--accent)" : "var(--border-subtle)",
                        color: active ? "var(--accent)" : "var(--text-secondary)",
                      }}
                    >
                      <span>{sp.label}</span>
                      <span className="text-[10px] opacity-70">({sp.desc})</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          <section
            className="space-y-3 pt-3 border-t"
            style={{ borderColor: "var(--border-subtle)" }}
          >
            <div className="flex items-center justify-between">
              <div>
                <span
                  className="text-xs font-semibold block"
                  style={{ color: "var(--text-secondary)" }}
                >
                  Источники и платформы агентов
                </span>
                <span
                  className="text-[11px]"
                  style={{ color: "var(--text-muted)" }}
                >
                  Мульти-выбор платформ для объединения в общем списке сессий
                </span>
              </div>
              <span
                className="text-[10px] font-semibold tabular-nums px-2 py-0.5 rounded border"
                style={{
                  backgroundColor: "var(--bg-elevated)",
                  borderColor: "var(--border-subtle)",
                  color: "var(--text-secondary)",
                }}
              >
                {enabledPlatforms.length} / {PLATFORMS.length}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {PLATFORMS.map((p) => {
                const isChecked = enabledPlatforms.includes(p.id);
                return (
                  <label
                    key={p.id}
                    className="flex items-start gap-2.5 p-2.5 rounded-xl border transition-all cursor-pointer select-none"
                    style={{
                      backgroundColor: isChecked
                        ? "var(--bg-panel)"
                        : "var(--bg-elevated)",
                      borderColor: isChecked
                        ? "var(--accent)"
                        : "var(--border-subtle)",
                    }}
                  >
                    <div className="pt-0.5 shrink-0">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleTogglePlatform(p.id)}
                        className="sr-only"
                      />
                      <div
                        className="w-4 h-4 rounded border flex items-center justify-center transition-colors"
                        style={{
                          backgroundColor: isChecked
                            ? "var(--accent)"
                            : "transparent",
                          borderColor: isChecked
                            ? "var(--accent)"
                            : "var(--border-strong)",
                        }}
                      >
                        {isChecked && (
                          <Check
                            className="w-3 h-3 text-white"
                            strokeWidth={2.6}
                          />
                        )}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span
                          className="font-semibold text-xs truncate"
                          style={{
                            color: isChecked
                              ? "var(--text-primary)"
                              : "var(--text-secondary)",
                          }}
                        >
                          {p.label}
                        </span>
                        <span
                          className="px-1.5 py-0.2 rounded text-[9px] font-bold shrink-0 border"
                          style={{
                            borderColor: p.badgeColor,
                            color: p.badgeColor,
                            backgroundColor: "rgba(0,0,0,0.2)",
                          }}
                        >
                          {p.badge}
                        </span>
                      </div>
                      <span
                        className="text-[11px] block mt-0.5 line-clamp-1"
                        style={{ color: "var(--text-muted)" }}
                      >
                        {p.desc}
                      </span>
                    </div>
                  </label>
                );
              })}
            </div>

            {enabledPlatforms.includes("custom") && (
              <div
                className="p-3 rounded-xl border space-y-2.5"
                style={{
                  backgroundColor: "var(--bg-elevated)",
                  borderColor: "var(--border-subtle)",
                }}
              >
                <div className="flex items-center justify-between">
                  <span
                    className="text-xs font-semibold"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    Пользовательские каталоги агентов
                  </span>
                  <button
                    type="button"
                    onClick={handleAddCustomPath}
                    className="h-6 px-2 rounded-md border text-[11px] font-medium flex items-center gap-1 transition-colors cursor-pointer"
                    style={{
                      backgroundColor: "var(--accent-soft)",
                      borderColor: "var(--accent)",
                      color: "var(--accent)",
                    }}
                  >
                    <Plus className="w-3 h-3" strokeWidth={2} />
                    <span>Добавить путь</span>
                  </button>
                </div>

                {(!settings.customSources ||
                  settings.customSources.length === 0) && (
                  <p
                    className="text-[11px]"
                    style={{ color: "var(--text-muted)" }}
                  >
                    Добавьте папку с сессиями кастомного агента, где есть
                    директория .system_generated/swarm или logs.
                  </p>
                )}

                {settings.customSources &&
                  settings.customSources.length > 0 && (
                    <div className="space-y-1.5 max-h-36 overflow-y-auto scroller">
                      {settings.customSources.map((cs) => (
                        <div
                          key={cs.id}
                          className="flex items-center justify-between gap-2 p-2 rounded-lg border text-xs"
                          style={{
                            backgroundColor: "var(--bg-panel)",
                            borderColor: "var(--border-subtle)",
                          }}
                        >
                          <label className="flex items-center gap-2 min-w-0 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={cs.enabled}
                              onChange={(e) =>
                                handleToggleCustomSource(
                                  cs.id,
                                  e.target.checked,
                                )
                              }
                              className="w-3.5 h-3.5 accent-[var(--accent)] cursor-pointer"
                            />
                            <div className="min-w-0">
                              <input
                                type="text"
                                value={cs.name}
                                onChange={(e) =>
                                  handleRenameCustomSource(
                                    cs.id,
                                    e.target.value,
                                  )
                                }
                                onClick={(e) => e.stopPropagation()}
                                placeholder="Имя агента..."
                                title="Кликните, чтобы задать или изменить имя агента"
                                className="font-semibold text-xs bg-transparent border-b border-dashed border-transparent hover:border-slate-500 focus:border-[var(--accent)] outline-none transition-colors px-0 py-0.5 max-w-[220px] w-full block truncate"
                                style={{ color: "var(--text-primary)" }}
                              />
                              <span
                                className="text-[10px] block truncate font-mono opacity-80"
                                style={{ color: "var(--text-muted)" }}
                                title={cs.path}
                              >
                                {cs.path}
                              </span>
                            </div>
                          </label>
                          <button
                            type="button"
                            onClick={() => handleRemoveCustomSource(cs.id)}
                            title="Удалить источник"
                            className="w-6 h-6 rounded flex items-center justify-center hover:bg-red-500/15 hover:text-red-400 transition-colors cursor-pointer shrink-0"
                            style={{ color: "var(--text-muted)" }}
                          >
                            <Trash2 className="w-3 h-3" strokeWidth={1.8} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
              </div>
            )}
          </section>

          <section className="space-y-2 pt-2 border-t" style={{ borderColor: "var(--border-subtle)" }}>
            <label className="text-xs font-semibold block" style={{ color: "var(--text-secondary)" }}>
              Сетка холста
            </label>
            <div className="grid grid-cols-3 gap-2">
              {GRIDS.map((g) => {
                const active = settings.gridStyle === g.id;
                return (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() =>
                      onUpdateSettings((s) => ({ ...s, gridStyle: g.id }))
                    }
                    className="h-8 px-2 rounded-lg border text-xs font-medium flex items-center justify-center transition-all cursor-pointer"
                    style={{
                      backgroundColor: active ? "var(--accent-soft)" : "var(--bg-elevated)",
                      borderColor: active ? "var(--accent)" : "var(--border-subtle)",
                      color: active ? "var(--accent)" : "var(--text-secondary)",
                    }}
                  >
                    {g.label}
                  </button>
                );
              })}
            </div>
          </section>

          <section className="pt-2 border-t flex items-center justify-between" style={{ borderColor: "var(--border-subtle)" }}>
            <div>
              <span className="font-medium text-xs block">Папка Antigravity brain</span>
              <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                Каталог с логами транскриптов и сессий агентов
              </span>
            </div>
            <button
              type="button"
              onClick={onChangeBrainDir}
              className="h-8 px-3 rounded-lg border flex items-center gap-2 text-xs font-medium transition-colors cursor-pointer"
              style={{
                backgroundColor: "var(--bg-elevated)",
                borderColor: "var(--border-subtle)",
                color: "var(--text-primary)",
              }}
            >
              <FolderOpen className="w-3.5 h-3.5" strokeWidth={1.5} />
              <span>Выбрать папку</span>
            </button>
          </section>
        </div>

        <div
          className="h-14 px-5 border-t flex items-center justify-end shrink-0"
          style={{ borderColor: "var(--border-subtle)" }}
        >
          <button
            type="button"
            onClick={onClose}
            className="h-8 px-4 rounded-lg text-xs font-medium transition-opacity cursor-pointer"
            style={{
              backgroundColor: "var(--accent)",
              color: "var(--accent-fg)",
            }}
          >
            Готово
          </button>
        </div>
      </div>
    </dialog>
  );
}
