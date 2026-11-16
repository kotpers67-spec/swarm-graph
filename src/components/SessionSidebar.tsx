import { useState } from "react";
import {
  GitBranch,
  Hash,
  Network,
  Plus,
  Search,
  Zap,
} from "lucide-react";
import { formatStatusRu, shortModelName } from "../lib/formatters";
import type {
  AgentPlatform,
  GraphNode,
  SessionDetail,
  SessionSummary,
} from "../types";

interface SessionSidebarProps {
  width?: number;
  sessions: SessionSummary[];
  selectedSessionId: string | null;
  detail: SessionDetail | null;
  graphNodes: GraphNode[];
  selectedNodeId: string | null;
  activeChannel: string;
  onlyActiveSessions: boolean;
  enabledPlatforms?: AgentPlatform[];
  onToggleOnlyActiveSessions: () => void;
  onOpenCreateSwarm: () => void;
  onSelectSession: (id: string) => void;
  onSelectNode: (id: string) => void;
  onSelectChannel: (channel: string) => void;
}

function getPlatformBadge(s: SessionSummary): {
  label: string;
  color: string;
  bg: string;
  border: string;
} {
  const p =
    s.platform ||
    (s.source === "claude"
      ? "claude_code"
      : s.source === "codex"
        ? "codex"
        : "antigravity");

  switch (p) {
    case "claude_code":
      return {
        label: "Claude Code",
        color: "#f59e0b",
        bg: "rgba(245, 158, 11, 0.12)",
        border: "rgba(245, 158, 11, 0.35)",
      };
    case "codex":
      return {
        label: "Codex",
        color: "#10b981",
        bg: "rgba(16, 185, 129, 0.12)",
        border: "rgba(16, 185, 129, 0.35)",
      };
    case "custom":
      return {
        label: "Кастомный",
        color: "#8b5cf6",
        bg: "rgba(139, 92, 246, 0.12)",
        border: "rgba(139, 92, 246, 0.35)",
      };
    case "antigravity":
    default:
      return {
        label: "Antigravity",
        color: "var(--accent)",
        bg: "var(--accent-soft)",
        border: "var(--border-strong)",
      };
  }
}

export function SessionSidebar({
  width = 270,
  sessions,
  selectedSessionId,
  detail,
  graphNodes,
  selectedNodeId,
  activeChannel,
  onlyActiveSessions,
  enabledPlatforms,
  onToggleOnlyActiveSessions,
  onOpenCreateSwarm,
  onSelectSession,
  onSelectNode,
  onSelectChannel,
}: SessionSidebarProps) {
  const [query, setQuery] = useState("");

  const filteredSessions = sessions.filter((s) => {
    const q = query.trim().toLowerCase();
    const queryOk =
      !q || s.title.toLowerCase().includes(q) || s.id.toLowerCase().includes(q);
    const activeOk = !onlyActiveSessions || s.is_live;
    const platform =
      s.platform ||
      (s.source === "claude"
        ? "claude_code"
        : s.source === "codex"
          ? "codex"
          : "antigravity");
    const platformOk =
      !enabledPlatforms ||
      enabledPlatforms.length === 0 ||
      enabledPlatforms.includes(platform);
    return queryOk && activeOk && platformOk;
  });

  const activeCount = sessions.filter((s) => s.is_live).length;
  const channels = detail?.summary.channels ?? ["main"];

  return (
    <aside
      className="shrink-0 border-r flex flex-col min-h-0 select-none"
      style={{
        width,
        backgroundColor: "var(--bg-panel)",
        borderColor: "var(--border-subtle)",
      }}
    >
      <div className="p-2.5 border-b shrink-0 space-y-2" style={{ borderColor: "var(--border-subtle)" }}>
        <div className="flex items-center gap-1.5">
          <div
            className="flex-1 h-8 px-2.5 rounded-lg border flex items-center gap-2 min-w-0"
            style={{
              backgroundColor: "var(--bg-elevated)",
              borderColor: "var(--border-subtle)",
            }}
          >
            <Search
              className="w-3.5 h-3.5 shrink-0"
              strokeWidth={1.5}
              style={{ color: "var(--text-muted)" }}
            />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Фильтр сессий..."
              className="w-full min-w-0 bg-transparent text-xs outline-none"
              style={{ color: "var(--text-primary)" }}
            />
          </div>

          <button
            type="button"
            onClick={onOpenCreateSwarm}
            title="Запустить рой или добавить воркера"
            className="h-8 px-2.5 rounded-lg border text-xs font-semibold flex items-center gap-1 shrink-0 transition-all cursor-pointer"
            style={{
              backgroundColor: "var(--accent)",
              borderColor: "var(--accent)",
              color: "var(--accent-fg)",
            }}
          >
            <Plus className="w-3.5 h-3.5" strokeWidth={2.2} />
            <span>Рой</span>
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto scroller p-2 space-y-4">
        <div>
          <div className="px-2 pb-2 flex items-center justify-between">
            <div className="flex items-center gap-1.5 min-w-0">
              <span
                className="text-xs font-semibold tracking-tight truncate"
                style={{ color: "var(--text-primary)" }}
              >
                Рои и сессии
              </span>
              <span
                className="text-[10px] tabular-nums px-1.5 py-0.2 rounded border font-medium shrink-0"
                style={{
                  backgroundColor: "var(--bg-elevated)",
                  borderColor: "var(--border-subtle)",
                  color: "var(--text-muted)",
                }}
                title={`${filteredSessions.length} показано из ${sessions.length} (активных: ${activeCount})`}
              >
                {filteredSessions.length}/{sessions.length}
              </span>
            </div>

            <button
              type="button"
              onClick={onToggleOnlyActiveSessions}
              title={
                onlyActiveSessions
                  ? "Показаны только активные сессии (кликните, чтобы показать все)"
                  : "Показать только активные сессии роя"
              }
              className="h-5 px-2 rounded-md text-[10px] font-semibold border flex items-center gap-1 cursor-pointer transition-all shrink-0"
              style={{
                backgroundColor: onlyActiveSessions
                  ? "var(--accent-soft)"
                  : "var(--bg-elevated)",
                borderColor: onlyActiveSessions
                  ? "var(--accent)"
                  : "var(--border-subtle)",
                color: onlyActiveSessions
                  ? "var(--accent)"
                  : "var(--text-muted)",
              }}
            >
              <Zap
                className="w-2.5 h-2.5 shrink-0"
                strokeWidth={onlyActiveSessions ? 2.4 : 1.6}
              />
              <span>Активные</span>
              {onlyActiveSessions && (
                <span
                  className="w-1.5 h-1.5 rounded-full animate-pulse shrink-0"
                  style={{ backgroundColor: "var(--accent)" }}
                />
              )}
            </button>
          </div>

          <div className="space-y-1">
            {filteredSessions.map((s) => {
              const active = s.id === selectedSessionId;
              const platformBadge = getPlatformBadge(s);

              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => onSelectSession(s.id)}
                  className="w-full text-left px-2.5 py-2 rounded-xl border transition-all cursor-pointer flex items-start gap-2 min-w-0"
                  style={{
                    backgroundColor: active
                      ? "var(--accent-soft)"
                      : "transparent",
                    borderColor: active ? "var(--accent)" : "transparent",
                  }}
                >
                  <span
                    className="w-2 h-2 rounded-full mt-1.5 shrink-0"
                    style={{
                      backgroundColor: s.is_live
                        ? "var(--status-ok)"
                        : s.has_swarm
                          ? "var(--accent)"
                          : "var(--text-muted)",
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1.5 min-w-0">
                      <span
                        className="text-xs font-semibold truncate"
                        style={{
                          color: active
                            ? "var(--text-primary)"
                            : "var(--text-secondary)",
                        }}
                        title={s.title}
                      >
                        {s.title}
                      </span>
                      <span
                        className="px-1.5 py-0.2 rounded text-[9px] font-semibold shrink-0 border"
                        style={{
                          borderColor: platformBadge.border,
                          color: platformBadge.color,
                          backgroundColor: platformBadge.bg,
                        }}
                        title={`Платформа: ${platformBadge.label}`}
                      >
                        {platformBadge.label}
                      </span>
                    </div>
                    <div
                      className="mt-0.5 flex items-center gap-1.5 text-[11px] tabular-nums"
                      style={{ color: "var(--text-muted)" }}
                    >
                      <span>
                        {s.has_swarm
                          ? `Рой · ${s.member_count}`
                          : "Субагенты"}
                      </span>
                      {s.subagent_count > 0 && (
                        <span>· +{s.subagent_count} суб.</span>
                      )}
                      {s.board_count > 0 && <span>· {s.board_count}</span>}
                    </div>
                  </div>
                </button>
              );
            })}

            {filteredSessions.length === 0 && (
              <div
                className="px-3 py-6 text-center text-xs rounded-xl border border-dashed"
                style={{
                  color: "var(--text-muted)",
                  borderColor: "var(--border-subtle)",
                }}
              >
                {onlyActiveSessions
                  ? "Активных роев сейчас нет"
                  : "Сессии не найдены"}
              </div>
            )}
          </div>
        </div>

        {detail && channels.length > 0 && (
          <div>
            <div
              className="px-2 pb-1.5 text-[11px] font-semibold"
              style={{ color: "var(--text-muted)" }}
            >
              Каналы роя
            </div>
            <div className="flex flex-wrap gap-1 px-1">
              <button
                type="button"
                onClick={() => onSelectChannel("*")}
                className="h-6 px-2 rounded-md text-[11px] font-medium border cursor-pointer transition-colors"
                style={{
                  backgroundColor:
                    activeChannel === "*"
                      ? "var(--accent-soft)"
                      : "var(--bg-elevated)",
                  borderColor:
                    activeChannel === "*"
                      ? "var(--accent)"
                      : "var(--border-subtle)",
                  color:
                    activeChannel === "*"
                      ? "var(--accent)"
                      : "var(--text-secondary)",
                }}
              >
                Все
              </button>
              {channels.map((ch) => {
                const active = activeChannel === ch;
                return (
                  <button
                    key={ch}
                    type="button"
                    onClick={() => onSelectChannel(ch)}
                    className="h-6 px-2 rounded-md text-[11px] font-medium border flex items-center gap-1 cursor-pointer transition-colors"
                    style={{
                      backgroundColor: active
                        ? "var(--accent-soft)"
                        : "var(--bg-elevated)",
                      borderColor: active
                        ? "var(--accent)"
                        : "var(--border-subtle)",
                      color: active
                        ? "var(--accent)"
                        : "var(--text-secondary)",
                    }}
                  >
                    <Hash className="w-3 h-3 shrink-0" strokeWidth={1.5} />
                    <span>{ch}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {graphNodes.length > 0 && (
          <div>
            <div className="px-2 pb-1.5 flex items-center justify-between">
              <span
                className="text-[11px] font-semibold"
                style={{ color: "var(--text-muted)" }}
              >
                Участники графа
              </span>
              <span
                className="text-[11px] tabular-nums"
                style={{ color: "var(--text-muted)" }}
              >
                {graphNodes.length}
              </span>
            </div>
            <div className="space-y-1">
              {graphNodes.map((n) => {
                const selected = n.id === selectedNodeId;
                return (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => onSelectNode(n.id)}
                    className="w-full text-left px-2.5 py-1.5 rounded-xl border transition-all cursor-pointer flex items-center gap-2 min-w-0"
                    style={{
                      backgroundColor: selected
                        ? "var(--accent-soft)"
                        : "transparent",
                      borderColor: selected ? "var(--accent)" : "transparent",
                    }}
                  >
                    {n.kind === "subagent" ? (
                      <GitBranch
                        className="w-3.5 h-3.5 shrink-0"
                        strokeWidth={1.5}
                        style={{ color: "var(--text-muted)" }}
                      />
                    ) : (
                      <Network
                        className="w-3.5 h-3.5 shrink-0"
                        strokeWidth={1.5}
                        style={{ color: "var(--accent)" }}
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span
                          className="text-xs font-semibold truncate"
                          style={{ color: "var(--text-primary)" }}
                          title={n.label}
                        >
                          {n.label}
                        </span>
                        <span
                          className="text-[10px] shrink-0 tabular-nums"
                          style={{ color: "var(--text-muted)" }}
                        >
                          {shortModelName(n.model)}
                        </span>
                      </div>
                      <div
                        className="text-[10px] truncate"
                        style={{ color: "var(--text-muted)" }}
                      >
                        {formatStatusRu(n.status)} · {n.sentCount} отпр.
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
