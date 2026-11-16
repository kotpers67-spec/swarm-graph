import { useState } from "react";
import {
  Bot,
  Copy,
  Network,
  Plus,
  Send,
  Terminal,
  Trash2,
  UserPlus,
  X,
} from "lucide-react";
import { shortModelName } from "../lib/formatters";
import type { SessionDetail } from "../types";

interface SwarmControlModalProps {
  open: boolean;
  activeSession: SessionDetail | null;
  onClose: () => void;
  onAddWorker: (payload: {
    name: string;
    role: "worker" | "verifier" | "utility";
    model: string;
    brief: string;
  }) => Promise<void>;
  onPostMessage: (text: string) => Promise<void>;
  onKillWorker?: (name: string) => Promise<void>;
}

const AVAILABLE_MODELS = [
  { id: "gemini-3.8-flash-high", name: "Gemini 3.8 Flash (High)", family: "Gemini" },
  { id: "gemini-3.8-flash-medium", name: "Gemini 3.8 Flash (Medium)", family: "Gemini" },
  { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro", family: "Gemini" },
  { id: "claude-sonnet-4-6", name: "Claude 3.7 Sonnet (Thinking)", family: "Claude" },
  { id: "claude-opus-4-6-thinking", name: "Claude Opus 4.6", family: "Claude" },
  { id: "gpt-oss-120b-medium", name: "GPT-OSS 120B / Codex", family: "OpenAI" },
];

export function SwarmControlModal({
  open,
  activeSession,
  onClose,
  onAddWorker,
  onPostMessage,
  onKillWorker,
}: SwarmControlModalProps) {
  const [activeTab, setActiveTab] = useState<"add" | "message" | "members" | "bridge">("add");
  const [workerName, setWorkerName] = useState("");
  const [role, setRole] = useState<"worker" | "verifier" | "utility">("worker");
  const [selectedModel, setSelectedModel] = useState("gemini-3.8-flash-high");
  const [brief, setBrief] = useState("");
  const [messageText, setMessageText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copiedBridge, setCopiedBridge] = useState(false);

  if (!open) return null;

  const handleCreateWorker = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workerName.trim() || !brief.trim()) return;
    setIsSubmitting(true);
    try {
      await onAddWorker({
        name: workerName.trim().toLowerCase().replace(/\s+/g, "-"),
        role,
        model: selectedModel,
        brief: brief.trim(),
      });
      setWorkerName("");
      setBrief("");
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim()) return;
    setIsSubmitting(true);
    try {
      await onPostMessage(messageText.trim());
      setMessageText("");
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const bridgeCommandClaude = `claude mcp add swarm-graph node "F:\\Projects\\графы работы агентов\\publish\\bridge\\swarm-mcp.cjs"`;
  const bridgeCommandCodex = `swarm-cli post "@coordinator задача выполнена"`;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedBridge(true);
    setTimeout(() => setCopiedBridge(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm select-none">
      <div
        className="w-full max-w-2xl rounded-2xl border shadow-2xl flex flex-col overflow-hidden max-h-[88vh]"
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
              <Network className="w-4 h-4" strokeWidth={1.8} />
            </span>
            <div>
              <h2 className="text-sm font-semibold tracking-tight">
                Командный Центр /swarm
              </h2>
              <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                {activeSession
                  ? `${activeSession.summary.title} · ${activeSession.members.length} агентов`
                  : "Управление роем агентов и подключение Claude Code / Codex"}
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

        <div
          className="flex border-b px-4 gap-2 shrink-0"
          style={{
            backgroundColor: "var(--bg-app)",
            borderColor: "var(--border-subtle)",
          }}
        >
          {[
            { id: "add", label: "Добавить агента", icon: UserPlus },
            { id: "message", label: "Отправить задание", icon: Send },
            { id: "members", label: "Состав роя", icon: Bot },
            { id: "bridge", label: "Мост для Claude / Codex", icon: Terminal },
          ].map((tab) => {
            const active = activeTab === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className="py-3 px-3 text-xs font-semibold flex items-center gap-1.5 border-b-2 cursor-pointer transition-colors"
                style={{
                  borderColor: active ? "var(--accent)" : "transparent",
                  color: active ? "var(--accent)" : "var(--text-muted)",
                }}
              >
                <Icon className="w-3.5 h-3.5" strokeWidth={1.6} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        <div className="p-5 overflow-y-auto min-h-0 space-y-4 flex-1">
          {activeTab === "add" && (
            <form onSubmit={handleCreateWorker} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold block" style={{ color: "var(--text-secondary)" }}>
                    Имя агента (@name)
                  </label>
                  <input
                    type="text"
                    required
                    value={workerName}
                    onChange={(e) => setWorkerName(e.target.value)}
                    placeholder="например: verifier, builder, qa"
                    className="w-full h-9 px-3 rounded-xl border text-xs outline-none"
                    style={{
                      backgroundColor: "var(--bg-elevated)",
                      borderColor: "var(--border-subtle)",
                      color: "var(--text-primary)",
                    }}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold block" style={{ color: "var(--text-secondary)" }}>
                    Роль участника
                  </label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as any)}
                    className="w-full h-9 px-3 rounded-xl border text-xs outline-none cursor-pointer"
                    style={{
                      backgroundColor: "var(--bg-elevated)",
                      borderColor: "var(--border-subtle)",
                      color: "var(--text-primary)",
                    }}
                  >
                    <option value="worker">Исполнитель (Worker)</option>
                    <option value="verifier">Верификатор (Verifier)</option>
                    <option value="utility">Сервис / Монитор (Utility)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold block" style={{ color: "var(--text-secondary)" }}>
                  Модель агента (Claude, Codex, Gemini)
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {AVAILABLE_MODELS.map((m) => {
                    const active = selectedModel === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setSelectedModel(m.id)}
                        className="p-2.5 rounded-xl border text-left cursor-pointer flex items-center justify-between transition-all"
                        style={{
                          backgroundColor: active ? "var(--accent-soft)" : "var(--bg-elevated)",
                          borderColor: active ? "var(--accent)" : "var(--border-subtle)",
                        }}
                      >
                        <div>
                          <div className="text-xs font-semibold" style={{ color: active ? "var(--accent)" : "var(--text-primary)" }}>
                            {m.name}
                          </div>
                          <div className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                            Семья: {m.family}
                          </div>
                        </div>
                        {active && <span className="w-2 h-2 rounded-full" style={{ backgroundColor: "var(--accent)" }} />}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold block" style={{ color: "var(--text-secondary)" }}>
                  Бриф задачи (@mention assignment)
                </label>
                <textarea
                  required
                  rows={4}
                  value={brief}
                  onChange={(e) => setBrief(e.target.value)}
                  placeholder="Опишите задачу агента: что он делает, какие файлы проверяет и как должен отчитаться..."
                  className="w-full p-3 rounded-xl border text-xs outline-none resize-none font-mono"
                  style={{
                    backgroundColor: "var(--bg-elevated)",
                    borderColor: "var(--border-subtle)",
                    color: "var(--text-primary)",
                  }}
                />
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting || !workerName.trim() || !brief.trim()}
                  className="h-9 px-5 rounded-xl text-xs font-semibold flex items-center gap-2 cursor-pointer transition-opacity disabled:opacity-40"
                  style={{
                    backgroundColor: "var(--accent)",
                    color: "var(--accent-fg)",
                  }}
                >
                  <Plus className="w-3.5 h-3.5" strokeWidth={2.2} />
                  <span>{isSubmitting ? "Добавление..." : "Запустить агента в рой"}</span>
                </button>
              </div>
            </form>
          )}

          {activeTab === "message" && (
            <form onSubmit={handleSendMessage} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold block" style={{ color: "var(--text-secondary)" }}>
                  Сообщение координатора на доску роя
                </label>
                <textarea
                  required
                  rows={5}
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  placeholder="@worker-1 проверь тесты Vitest и отчитайся о результатах сборки..."
                  className="w-full p-3 rounded-xl border text-xs outline-none resize-none font-mono"
                  style={{
                    backgroundColor: "var(--bg-elevated)",
                    borderColor: "var(--border-subtle)",
                    color: "var(--text-primary)",
                  }}
                />
                <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                  Используйте @all или @имя_агента, чтобы разбудить нужного участника
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting || !messageText.trim()}
                  className="h-9 px-5 rounded-xl text-xs font-semibold flex items-center gap-2 cursor-pointer transition-opacity disabled:opacity-40"
                  style={{
                    backgroundColor: "var(--accent)",
                    color: "var(--accent-fg)",
                  }}
                >
                  <Send className="w-3.5 h-3.5" strokeWidth={1.8} />
                  <span>{isSubmitting ? "Отправка..." : "Опубликовать на доске"}</span>
                </button>
              </div>
            </form>
          )}

          {activeTab === "members" && (
            <div className="space-y-2">
              <div className="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
                Текущие участники ({activeSession?.members.length ?? 0})
              </div>
              <div className="space-y-2">
                {activeSession?.members.map((m) => (
                  <div
                    key={m.name}
                    className="p-3 rounded-xl border flex items-center justify-between gap-3"
                    style={{
                      backgroundColor: "var(--bg-elevated)",
                      borderColor: "var(--border-subtle)",
                    }}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{
                          backgroundColor: m.killed
                            ? "var(--status-err)"
                            : m.wake_mode === "working"
                              ? "var(--accent)"
                              : "var(--status-ok)",
                        }}
                      />
                      <div className="min-w-0">
                        <div className="text-xs font-bold truncate">@{m.name}</div>
                        <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                          {m.role} · {shortModelName(m.model)} · {m.wake_mode}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {onKillWorker && !m.killed && m.name !== "coordinator" && (
                        <button
                          type="button"
                          onClick={() => onKillWorker(m.name)}
                          title="Завершить работу агента"
                          className="h-7 px-2 rounded-lg border text-[11px] font-medium flex items-center gap-1 cursor-pointer hover:bg-red-500/10 hover:text-red-400 transition-colors"
                          style={{
                            borderColor: "var(--border-subtle)",
                            color: "var(--text-muted)",
                          }}
                        >
                          <Trash2 className="w-3 h-3" strokeWidth={1.6} />
                          <span>Завершить</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === "bridge" && (
            <div className="space-y-4">
              <div>
                <h3 className="text-xs font-bold tracking-tight mb-1">
                  Подключение любого внешнего агента к рою
                </h3>
                <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                  Любой сторонний агент (Claude Code, OpenAI Codex CLI, Cursor) может читать задачи с доски и отправлять отчеты через общий мост SwarmGraph.
                </p>
              </div>

              <div
                className="p-3.5 rounded-xl border space-y-2"
                style={{
                  backgroundColor: "var(--bg-elevated)",
                  borderColor: "var(--border-subtle)",
                }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold flex items-center gap-1.5">
                    <Bot className="w-3.5 h-3.5" style={{ color: "#d97706" }} />
                    <span>Для Claude Code (через MCP):</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(bridgeCommandClaude)}
                    className="h-6 px-2 rounded-md border text-[10px] font-medium flex items-center gap-1 cursor-pointer transition-colors"
                    style={{
                      backgroundColor: "var(--bg-panel)",
                      borderColor: "var(--border-subtle)",
                      color: copiedBridge ? "var(--status-ok)" : "var(--text-secondary)",
                    }}
                  >
                    <Copy className="w-3 h-3" />
                    <span>{copiedBridge ? "Скопировано!" : "Копировать"}</span>
                  </button>
                </div>
                <pre
                  className="p-2.5 rounded-lg text-[11px] overflow-x-auto font-mono select-all"
                  style={{
                    backgroundColor: "var(--bg-app)",
                    color: "var(--text-primary)",
                  }}
                >
                  {bridgeCommandClaude}
                </pre>
              </div>

              <div
                className="p-3.5 rounded-xl border space-y-2"
                style={{
                  backgroundColor: "var(--bg-elevated)",
                  borderColor: "var(--border-subtle)",
                }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold flex items-center gap-1.5">
                    <Terminal className="w-3.5 h-3.5" style={{ color: "#10b981" }} />
                    <span>Для OpenAI Codex / Shell CLI:</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(bridgeCommandCodex)}
                    className="h-6 px-2 rounded-md border text-[10px] font-medium flex items-center gap-1 cursor-pointer transition-colors"
                    style={{
                      backgroundColor: "var(--bg-panel)",
                      borderColor: "var(--border-subtle)",
                      color: copiedBridge ? "var(--status-ok)" : "var(--text-secondary)",
                    }}
                  >
                    <Copy className="w-3 h-3" />
                    <span>{copiedBridge ? "Скопировано!" : "Копировать"}</span>
                  </button>
                </div>
                <pre
                  className="p-2.5 rounded-lg text-[11px] overflow-x-auto font-mono select-all"
                  style={{
                    backgroundColor: "var(--bg-app)",
                    color: "var(--text-primary)",
                  }}
                >
                  {bridgeCommandCodex}
                </pre>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
