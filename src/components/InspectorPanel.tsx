import { useState } from "react";
import { ArrowRight, Bot, ChevronRight, Cpu, FileText, Languages, MessageSquare, Users } from "lucide-react";
import { formatRoleRu, formatStatusRu, formatTimeShort, shortModelName } from "../lib/formatters";
import type { BoardMessage, GraphNode, SessionDetail, ToolAction, TranscriptStep } from "../types";

interface InspectorPanelProps {
  width?: number;
  detail: SessionDetail | null;
  graphNodes: GraphNode[];
  selectedNodeId: string | null;
  filteredBoard: BoardMessage[];
  replaySeq: number | null;
  autoTranslate: boolean;
  translatedMap: Record<string, string>;
  onSelectNode: (id: string) => void;
  onJumpToSeq: (seq: number) => void;
}

type InspectorTab = "board" | "transcript" | "members";

export function parseDiffStats(diffStats?: string): { added?: string; removed?: string } | null {
  if (!diffStats) return null;
  const match = diffStats.match(/(\+\d+)?\s*(-\d+)?/);
  if (!match || (!match[1] && !match[2])) return null;
  return {
    added: match[1]?.trim(),
    removed: match[2]?.trim(),
  };
}

export function getExtensionColor(ext?: string): string {
  if (!ext) return "#94a3b8";
  const upper = ext.toUpperCase().replace(/^\./, "");
  switch (upper) {
    case "TS":
    case "TSX":
      return "#3b82f6";
    case "PY":
    case "PYTHON":
      return "#22c55e";
    case "RS":
    case "RUST":
      return "#f97316";
    case "JSON":
      return "#eab308";
    case "JS":
    case "JSX":
    case "MJS":
    case "CJS":
      return "#facc15";
    case "HTML":
    case "HTM":
      return "#ef4444";
    case "CSS":
    case "SCSS":
    case "LESS":
      return "#06b6d4";
    case "MD":
    case "MARKDOWN":
      return "#a855f7";
    case "TOML":
    case "YAML":
    case "YML":
      return "#ec4899";
    default:
      return "#94a3b8";
  }
}

export function getActionVerb(action: ToolAction, lang: "ru" | "en"): string {
  if (lang === "ru") {
    switch (action.kind) {
      case "create":
        return "Создаю";
      case "edit":
        return "Редактирую";
      case "read":
        return "Читаю";
      case "run":
      case "other":
        return "Выполняю";
      case "think":
        return "Анализирую";
      case "search":
        return "Ищу";
      case "user":
        return "Промпт";
      case "generic":
        return "Отвечаю";
      default:
        if (action.verb_ru === "Создал") return "Создаю";
        if (action.verb_ru === "Изменил") return "Редактирую";
        if (action.verb_ru === "Запустил") return "Выполняю";
        if (action.verb_ru === "Прочитал") return "Читаю";
        if (action.verb_ru === "Анализирует") return "Анализирую";
        if (action.verb_ru === "Ответил") return "Отвечаю";
        return action.verb_ru || "Выполняю";
    }
  }
  return action.verb_en || (action.kind === "create" ? "Created" : action.kind === "edit" ? "Edited" : "Ran");
}

export function localizeDetail(
  detail: string,
  lang: "ru" | "en",
  verbEn: string,
  verbRu?: string
): string {
  if (!detail) return "";
  let text = detail;
  if (verbEn && text.startsWith(verbEn + " ")) {
    text = text.slice(verbEn.length + 1);
  }
  if (verbRu && text.startsWith(verbRu + " ")) {
    text = text.slice(verbRu.length + 1);
  }
  if (lang === "ru") {
    if (verbRu === "Читаю") {
      text = text.replace(/^read\s+/i, "");
    } else {
      text = text.replace(/^read\s+/i, "чтение ");
    }
    text = text
      .replace(/^check\s+/i, "проверка ")
      .replace(/^search\s+/i, "поиск ")
      .replace(/^edit\s+/i, "изменение ")
      .replace(/^write\s+/i, "запись ")
      .replace(/^create\s+/i, "создание ")
      .replace(/^run\s+/i, "запуск ")
      .replace(/\bin\b/gi, "в")
      .replace(/\bdeclaration\b/gi, "декларации")
      .replace(/\btop of\b/gi, "начала")
      .replace(/\brest of\b/gi, "остальной части")
      .replace(/\bavailability\b/gi, "доступности")
      .replace(/\bmapping\b/gi, "маппинга")
      .replace(/\bresponse\b/gi, "ответа")
      .replace(/\bfacets\b/gi, "фасетов")
      .replace(/\bpipeline\b/gi, "конвейера");
  }
  return text.trim();
}

export function getStepActions(step: TranscriptStep): ToolAction[] {
  if (step.actions && step.actions.length > 0) {
    return step.actions;
  }
  if (step.step_type === "USER_INPUT") {
    const firstLine = step.content_preview?.split("\n")[0]?.trim() || "Запрос пользователя";
    return [
      {
        kind: "user",
        verb_en: "Prompt",
        verb_ru: "Промпт",
        detail: firstLine.slice(0, 80),
      },
    ];
  }
  if (step.tool_names && step.tool_names.length > 0) {
    return step.tool_names.map((tool) => {
      let kind: ToolAction["kind"] = "run";
      let verb_en = "Ran";
      let verb_ru = "Выполняю";
      if (tool.includes("read")) {
        kind = "read";
        verb_ru = "Читаю";
      } else if (tool.includes("edit")) {
        kind = "edit";
        verb_en = "Edited";
        verb_ru = "Редактирую";
      } else if (tool.includes("write") || tool.includes("create")) {
        kind = "create";
        verb_en = "Created";
        verb_ru = "Создаю";
      } else if (tool.includes("search")) {
        kind = "search";
        verb_ru = "Ищу";
      }
      return {
        kind,
        verb_en,
        verb_ru,
        detail: tool,
      };
    });
  }
  const preview = step.content_preview?.trim() || "";
  const firstLine = preview.split("\n")[0]?.trim() || "";
  if (step.step_type === "PLANNER_RESPONSE" && !preview.toLowerCase().includes("thinking")) {
    return [
      {
        kind: "generic",
        verb_en: "Responded",
        verb_ru: "Отвечаю",
        detail: firstLine.slice(0, 80) || "Ответ модели",
      },
    ];
  }
  return [
    {
      kind: "think",
      verb_en: "Analyzed",
      verb_ru: "Анализирую",
      detail: firstLine.slice(0, 80) || "Обработка запроса",
    },
  ];
}

export function InspectorPanel({
  width = 360,
  detail,
  graphNodes,
  selectedNodeId,
  filteredBoard,
  replaySeq,
  autoTranslate,
  translatedMap,
  onSelectNode,
  onJumpToSeq,
}: InspectorPanelProps) {
  const [tab, setTab] = useState<InspectorTab>("board");
  const [stepsLang, setStepsLang] = useState<"ru" | "en">("ru");
  const [showOriginalIds, setShowOriginalIds] = useState<Record<string, boolean>>({});
  const [expandedStepKeys, setExpandedStepKeys] = useState<Record<string, boolean>>({});
  const [boardFilter, setBoardFilter] = useState("");

  const toggleOriginal = (key: string) => {
    setShowOriginalIds((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleStepExpanded = (key: string) => {
    setExpandedStepKeys((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const selectedNode = graphNodes.find((n) => n.id === selectedNodeId) ?? graphNodes[0] ?? null;
  const selectedSteps: TranscriptStep[] = selectedNode
    ? detail?.transcripts[selectedNode.conversationId] ?? []
    : [];

  const visibleMessages = filteredBoard.filter((m) => {
    const q = boardFilter.trim().toLowerCase();
    if (!q) return true;
    const tr = translatedMap[m.text.trim()] ?? "";
    return (
      m.agent.toLowerCase().includes(q) ||
      m.text.toLowerCase().includes(q) ||
      tr.toLowerCase().includes(q) ||
      String(m.seq).includes(q) ||
      `#${m.seq}`.includes(q)
    );
  });

  const renderTranslatedBlock = (key: string, rawText: string) => {
    const trimmed = rawText.trim();
    const translated = translatedMap[trimmed];
    const hasRu = Boolean(translated && translated !== trimmed);
    const showOrig = Boolean(showOriginalIds[key]);
    const displayText = autoTranslate && hasRu && !showOrig ? translated : rawText;

    return (
      <div className="space-y-1.5">
        <div
          className="text-xs leading-relaxed whitespace-pre-wrap break-words"
          style={{ color: "var(--text-secondary)" }}
        >
          {displayText}
        </div>
        {hasRu && (
          <button
            type="button"
            onClick={() => toggleOriginal(key)}
            className="inline-flex items-center gap-1 text-[11px] font-medium cursor-pointer"
            style={{ color: "var(--accent)" }}
          >
            <Languages className="w-3 h-3" strokeWidth={1.5} />
            <span>{showOrig || !autoTranslate ? "Показать перевод RU" : "Переведено с EN · показать оригинал"}</span>
          </button>
        )}
      </div>
    );
  };

  return (
    <aside
      className="shrink-0 border-l flex flex-col min-h-0 select-none"
      style={{
        width,
        backgroundColor: "var(--bg-panel)",
        borderColor: "var(--border-subtle)",
      }}
    >
      <div
        className="h-11 px-2 border-b flex items-center gap-1 shrink-0"
        style={{ borderColor: "var(--border-subtle)" }}
      >
        {(
          [
            { id: "board", label: "Доска", icon: MessageSquare, count: filteredBoard.length },
            { id: "transcript", label: "Шаги", icon: FileText, count: selectedSteps.length },
            { id: "members", label: "Состав", icon: Users, count: graphNodes.length },
          ] as const
        ).map((item) => {
          const active = tab === item.id;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className="flex-1 h-8 px-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer min-w-0"
              style={{
                backgroundColor: active ? "var(--bg-elevated)" : "transparent",
                color: active ? "var(--text-primary)" : "var(--text-muted)",
              }}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" strokeWidth={1.5} />
              <span className="truncate">{item.label}</span>
              <span className="text-[10px] tabular-nums opacity-80">{item.count}</span>
            </button>
          );
        })}
      </div>

      {tab === "board" && (
        <div className="flex-1 min-h-0 flex flex-col">
          <div className="p-2.5 border-b shrink-0" style={{ borderColor: "var(--border-subtle)" }}>
            <input
              type="text"
              value={boardFilter}
              onChange={(e) => setBoardFilter(e.target.value)}
              placeholder="Поиск по сообщениям, @агенту или номеру..."
              className="w-full h-8 px-2.5 rounded-lg border text-xs outline-none"
              style={{
                backgroundColor: "var(--bg-elevated)",
                borderColor: "var(--border-subtle)",
                color: "var(--text-primary)",
              }}
            />
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto scroller p-3 space-y-2.5">
            {visibleMessages.map((msg) => {
              const isCursorMsg = replaySeq !== null && msg.seq === replaySeq;
              return (
                <article
                  key={msg.seq}
                  className="p-3 rounded-xl border space-y-2"
                  style={{
                    backgroundColor: isCursorMsg ? "var(--accent-soft)" : "var(--bg-elevated)",
                    borderColor: isCursorMsg ? "var(--accent)" : "var(--border-subtle)",
                  }}
                >
                  <div className="flex items-center justify-between gap-2 min-w-0">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <button
                        type="button"
                        onClick={() => onJumpToSeq(msg.seq)}
                        className="px-1.5 py-0.5 rounded text-[11px] font-semibold tabular-nums cursor-pointer shrink-0"
                        style={{
                          backgroundColor: "var(--bg-panel)",
                          color: "var(--accent)",
                        }}
                      >
                        {msg.seq}
                      </button>
                      <button
                        type="button"
                        onClick={() => onSelectNode(msg.agent)}
                        className="text-xs font-semibold truncate cursor-pointer"
                        style={{ color: "var(--text-primary)" }}
                      >
                        @{msg.agent}
                      </button>
                      {msg.kind === "brief" && (
                        <span
                          className="px-1.5 py-0.5 rounded text-[10px] font-medium shrink-0"
                          style={{
                            backgroundColor: "var(--bg-panel)",
                            color: "var(--text-muted)",
                          }}
                        >
                          задание
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] tabular-nums shrink-0" style={{ color: "var(--text-muted)" }}>
                      {formatTimeShort(msg.time)}
                    </span>
                  </div>

                  {msg.mentions.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1">
                      <ArrowRight className="w-3 h-3 shrink-0" strokeWidth={1.5} style={{ color: "var(--text-muted)" }} />
                      {msg.mentions.map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => onSelectNode(m)}
                          className="px-1.5 py-0.5 rounded text-[10px] font-medium cursor-pointer"
                          style={{
                            backgroundColor: "var(--bg-panel)",
                            color: "var(--accent)",
                          }}
                        >
                          @{m}
                        </button>
                      ))}
                    </div>
                  )}

                  {renderTranslatedBlock(`board-${msg.seq}`, msg.text)}
                </article>
              );
            })}

            {visibleMessages.length === 0 && (
              <div className="text-xs py-6 text-center" style={{ color: "var(--text-muted)" }}>
                Сообщений на доске нет
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "transcript" && (
        <div className="flex-1 min-h-0 flex flex-col">
          {selectedNode && (
            <div
              className="px-3 py-2 border-b flex items-center justify-between gap-2 shrink-0"
              style={{ borderColor: "var(--border-subtle)" }}
            >
              <div className="flex items-center gap-2 min-w-0">
                <Bot className="w-4 h-4 shrink-0" strokeWidth={1.5} style={{ color: "var(--accent)" }} />
                <span className="text-xs font-semibold truncate" style={{ color: "var(--text-primary)" }}>
                  {selectedNode.label}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <div
                  className="inline-flex items-center rounded-md border p-0.5 text-[10px] font-semibold select-none"
                  style={{
                    borderColor: "var(--border-subtle)",
                    backgroundColor: "var(--bg-elevated)",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setStepsLang("ru")}
                    title="Русские названия действий (Создал, Изменил, Запустил, Анализирует)"
                    className="px-1.5 py-0.5 rounded cursor-pointer transition-colors"
                    style={{
                      backgroundColor: stepsLang === "ru" ? "var(--accent)" : "transparent",
                      color: stepsLang === "ru" ? "#ffffff" : "var(--text-muted)",
                    }}
                  >
                    RU
                  </button>
                  <button
                    type="button"
                    onClick={() => setStepsLang("en")}
                    title="English action verbs (Created, Edited, Ran, Analyzed)"
                    className="px-1.5 py-0.5 rounded cursor-pointer transition-colors"
                    style={{
                      backgroundColor: stepsLang === "en" ? "var(--accent)" : "transparent",
                      color: stepsLang === "en" ? "#ffffff" : "var(--text-muted)",
                    }}
                  >
                    EN
                  </button>
                </div>
                <span className="text-[11px] tabular-nums" style={{ color: "var(--text-muted)" }}>
                  {shortModelName(selectedNode.model)}
                </span>
              </div>
            </div>
          )}

          <div className="flex-1 min-h-0 overflow-y-auto scroller p-2 space-y-1">
            {selectedSteps.map((step) => {
              const actions = getStepActions(step);
              const stepKey = `step-${selectedNode?.conversationId}-${step.step_index}`;
              const isExpanded = Boolean(expandedStepKeys[stepKey]);

              return (
                <div key={`${step.step_index}-${step.created_at}`} className="space-y-1">
                  {actions.map((action, actIdx) => {
                    const isFileAction =
                      action.kind === "create" ||
                      action.kind === "edit" ||
                      (Boolean(action.file_name) && Boolean(action.diff_stats));
                    const ext =
                      action.file_ext ||
                      (action.file_name && action.file_name.includes(".")
                        ? action.file_name.split(".").pop()?.toUpperCase()
                        : "");
                    const diffParts = parseDiffStats(action.diff_stats);
                    const verb = getActionVerb(action, stepsLang);
                    const displayDetail = localizeDetail(action.detail, stepsLang, action.verb_en, verb);
                    const actionRowKey = `${stepKey}-act-${actIdx}`;

                    return (
                      <div
                        key={actionRowKey}
                        onClick={() => toggleStepExpanded(stepKey)}
                        className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer select-none group ${
                          isExpanded
                            ? "bg-white/[0.08]"
                            : "hover:bg-white/[0.04]"
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <span
                            className="font-normal shrink-0"
                            style={{ color: "var(--text-primary, #f1f5f9)" }}
                          >
                            {verb}
                          </span>

                          {isFileAction && action.file_name ? (
                            <>
                              {ext && (
                                <span
                                  className="text-[10px] font-bold tracking-tight shrink-0 uppercase select-none"
                                  style={{ color: getExtensionColor(ext) }}
                                >
                                  {ext}
                                </span>
                              )}
                              <span
                                className="px-1.5 py-0.5 rounded text-[11px] font-mono shrink-0 truncate max-w-[200px]"
                                style={{ backgroundColor: "#152a48", color: "#f8fafc" }}
                                title={action.file_name}
                              >
                                {action.file_name}
                              </span>
                              {diffParts && (
                                <div className="flex items-center gap-1 font-mono text-[11px] tabular-nums font-semibold shrink-0 ml-0.5">
                                  {diffParts.added && <span className="text-emerald-400">{diffParts.added}</span>}
                                  {diffParts.removed && <span className="text-red-400">{diffParts.removed}</span>}
                                </div>
                              )}
                            </>
                          ) : (
                            <span
                              className="truncate font-normal"
                              style={{ color: "var(--text-secondary, #cbd5e1)" }}
                              title={displayDetail}
                            >
                              {displayDetail}
                            </span>
                          )}
                        </div>

                        {diffParts ? (
                          <ChevronRight
                            className={`w-3.5 h-3.5 shrink-0 ml-auto transition-transform duration-150 ${
                              isExpanded
                                ? "rotate-90 text-[var(--accent)]"
                                : "opacity-0 group-hover:opacity-100 text-slate-500"
                            }`}
                            strokeWidth={1.5}
                          />
                        ) : (
                          <ChevronRight
                            className={`w-3.5 h-3.5 shrink-0 ml-auto transition-transform duration-150 ${
                              isExpanded ? "rotate-90 text-[var(--accent)]" : "text-slate-500 group-hover:text-slate-300"
                            }`}
                            strokeWidth={1.5}
                          />
                        )}
                      </div>
                    );
                  })}

                  {isExpanded && (
                    <div
                      className="p-3 my-1 rounded-xl border space-y-2.5 transition-all text-xs"
                      style={{
                        backgroundColor: "var(--bg-elevated)",
                        borderColor: "var(--border-subtle)",
                      }}
                    >
                      <div
                        className="flex items-center justify-between gap-2 border-b pb-2"
                        style={{ borderColor: "var(--border-subtle)" }}
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span
                            className="px-1.5 py-0.5 rounded text-[10px] font-semibold tabular-nums"
                            style={{
                              backgroundColor: "var(--bg-panel)",
                              color: "var(--accent)",
                            }}
                          >
                            Шаг {step.step_index}
                          </span>
                          <span
                            className="text-xs font-medium truncate"
                            style={{ color: "var(--text-primary)" }}
                          >
                            {step.step_type === "USER_INPUT" ? "Запрос пользователя" : "Ответ модели"}
                          </span>
                          {step.status && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-medium uppercase tracking-wider text-slate-400 bg-slate-800/60">
                              {step.status}
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] tabular-nums shrink-0" style={{ color: "var(--text-muted)" }}>
                          {formatTimeShort(step.created_at)}
                        </span>
                      </div>

                      {step.tool_names.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {step.tool_names.map((tool, i) => (
                            <span
                              key={`${tool}-${i}`}
                              className="px-1.5 py-0.5 rounded text-[10px] font-mono border"
                              style={{
                                backgroundColor: "var(--bg-panel)",
                                borderColor: "var(--border-subtle)",
                                color: "var(--text-secondary)",
                              }}
                            >
                              {tool}
                            </span>
                          ))}
                        </div>
                      )}

                      {actions.some((a) => a.detail && !step.content_preview?.includes(a.detail)) && (
                        <div className="space-y-1">
                          {actions.map((act, idx) => {
                            const actVerb = getActionVerb(act, stepsLang);
                            const actDetail = localizeDetail(act.detail, stepsLang, act.verb_en, actVerb);
                            return (
                              <div
                                key={idx}
                                className="text-[11px] font-mono px-2 py-1 rounded border text-slate-300 break-all"
                                style={{
                                  backgroundColor: "var(--bg-panel)",
                                  borderColor: "var(--border-subtle)",
                                }}
                              >
                                {actVerb} {actDetail}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {step.content_preview && renderTranslatedBlock(stepKey, step.content_preview)}

                      {(step.input_tokens > 0 || step.output_tokens > 0) && (
                        <div
                          className="flex items-center justify-between text-[10px] tabular-nums pt-1 border-t"
                          style={{ borderColor: "var(--border-subtle)", color: "var(--text-muted)" }}
                        >
                          <span>
                            Токены: <strong className="text-slate-300">{step.input_tokens.toLocaleString("ru-RU")}</strong> вх / <strong className="text-slate-300">{step.output_tokens.toLocaleString("ru-RU")}</strong> вых
                          </span>
                          {step.source && <span className="opacity-70">{step.source}</span>}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {selectedSteps.length === 0 && (
              <div className="text-xs py-6 text-center" style={{ color: "var(--text-muted)" }}>
                Для выбранного узла нет записанных шагов транскрипта
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "members" && (
        <div className="flex-1 min-h-0 overflow-y-auto scroller p-3 space-y-2">
          {graphNodes.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => {
                onSelectNode(n.id);
                setTab("transcript");
              }}
              className="w-full text-left p-3 rounded-xl border space-y-1.5 cursor-pointer"
              style={{
                backgroundColor: n.id === selectedNodeId ? "var(--accent-soft)" : "var(--bg-elevated)",
                borderColor: n.id === selectedNodeId ? "var(--accent)" : "var(--border-subtle)",
              }}
            >
              <div className="flex items-center justify-between gap-2 min-w-0">
                <span className="text-xs font-semibold truncate" style={{ color: "var(--text-primary)" }}>
                  {n.label}
                </span>
                <span className="text-[11px] font-medium shrink-0" style={{ color: "var(--text-muted)" }}>
                  {formatRoleRu(n.kind)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2 text-[11px]" style={{ color: "var(--text-secondary)" }}>
                <span className="flex items-center gap-1 truncate">
                  <Cpu className="w-3 h-3 shrink-0" strokeWidth={1.5} />
                  <span className="truncate">{shortModelName(n.model)}</span>
                </span>
                <span className="tabular-nums shrink-0" style={{ color: "var(--text-muted)" }}>
                  {formatStatusRu(n.status)}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </aside>
  );
}
