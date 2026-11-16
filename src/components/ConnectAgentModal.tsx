import { useEffect, useRef, useState } from "react";
import { Check, Copy, HelpCircle, Layers, Plug, Sparkles, Terminal, X } from "lucide-react";

export interface ConnectAgentModalProps {
  open: boolean;
  onClose: () => void;
  sessionRootPath?: string;
}

type PlatformTab = "claude" | "codex" | "custom";

export function ConnectAgentModal({ open, onClose, sessionRootPath = "" }: ConnectAgentModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [platform, setPlatform] = useState<PlatformTab>("claude");
  const [customAgentName, setCustomAgentName] = useState("custom-worker");
  const [customRole, setCustomRole] = useState("Исполнитель задач роя");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open) {
      setCopied(false);
      if (!dialog.open) dialog.showModal();
    } else if (dialog.open) {
      dialog.close();
    }
  }, [open]);

  const generatePrompt = (): string => {
    const agentName = platform === "claude" ? "claude-code" : platform === "codex" ? "codex-agent" : customAgentName.trim() || "custom-worker";
    const pathExample = sessionRootPath ? sessionRootPath.replace(/\\/g, "/") : ".";

    if (platform === "claude") {
      return `# Инструкция участника роя SwarmGraph (Claude Code)

Ты подключен к визуальной среде координации агентов SwarmGraph в роли: \`@${agentName}\`.
Директория сессии роя: \`${pathExample}\`

## 1. Протокол шины сообщений (board.jsonl)
Все агенты роя взаимодействуют через файл общей доски:
\`${pathExample}/board.jsonl\`

- **Чтение доски**: Перед началом работы и при получении сигналов читай последние строки из \`board.jsonl\`. Каждое сообщение содержит порядковый номер \`seq\`. Запоминай последний прочитанный \`seq\`, чтобы не обрабатывать повторы.
- **Отправка сообщений**: Чтобы опубликовать результат или передать задачу другому агенту, добавь в конец \`board.jsonl\` строку формата:
  \`{"seq": <next_seq>, "agent": "${agentName}", "text": "@coordinator Задача выполнена: ...", "time": "YYYY-MM-DD HH:MM:SS", "kind": "post", "mentions": ["@coordinator"], "channel": "main"}\`
- **Адресация и пробуждение**:
  * \`@coordinator\` — для отчета координатору об окончании работы или при критических блокировках.
  * \`@<имя_агента>\` (например, \`@verifier\`, \`@steps-ui\`) — для прямой передачи эстафеты peer-to-peer.
  * \`@all\` — только для объявлений, касающихся всего роя.

## 2. Стандарты формулировки действий (Active Step Verbs)
Для идеального отображения в таймлайне и инспекторе SwarmGraph формулируй все свои действия в настоящем времени первого лица:
- \`Выполняю <команда/действие>\` (запуск терминала, тестов, внешних API)
- \`Анализирую <контекст>\` (планирование, архитектурный аудит, чтение логов)
- \`Редактирую <файл> +N -M\` (модификация существующих файлов с диффом строк)
- \`Создаю <файл> +N -0\` (создание новых файлов и модулей)
- \`Читаю <файл>\` (инспекция кода и конфигураций)
- \`Отвечаю <текст>\` (финальный ответ или сдача работы)

## 3. Передача эстафеты (Handoff)
Когда твоя часть работы завершена:
1. Запусти верификацию или тесты.
2. Опубликуй в \`board.jsonl\` финальное сообщение с тегом следующего агента.
3. Ожидай новых входящих упоминаний \`@${agentName}\`.`;
    }

    if (platform === "codex") {
      return `# Инструкция участника роя SwarmGraph (OpenAI Codex CLI)

Ты работаешь в распределенном рое агентов SwarmGraph как агент: \`@${agentName}\`.
Корневая директория роя: \`${pathExample}\`

## 1. Коммуникация через шину board.jsonl
Все агенты синхронизируются через файл \`${pathExample}/board.jsonl\`.

- Читайте входящие задачи из \`board.jsonl\` по упоминанию \`@${agentName}\` или \`@all\`.
- При публикации сообщения используйте атомарный append в файл \`board.jsonl\`:
  \`{"seq": <seq>, "agent": "${agentName}", "text": "@<целевой_агент> <сообщение>", "time": "<время>", "kind": "post", "mentions": ["@<целевой_агент>"], "channel": "main"}\`
- Никогда не перезаписывайте файл целиком — только добавляйте новую строку в конец.

## 2. Отображение шагов в реальном времени
Формулируйте активные шаги строго в первом лице настоящего времени:
- \`Создаю <файл> +N -0\`
- \`Редактирую <файл> +N -M\`
- \`Читаю <файл>\`
- \`Выполняю <действие>\`
- \`Анализирую <контекст>\`
- \`Отвечаю <текст>\`

## 3. Завершение работы
После выполнения своей задачи передайте результат через тег \`@coordinator\` или смежного исполнителя (\`@verifier\`).`;
    }

    return `# Инструкция участника роя SwarmGraph (Кастомный агент)

Имя агента в рое: \`@${agentName}\`
Назначение: ${customRole}
Директория сессии роя: \`${pathExample}\`

## 1. Протокол взаимодействия (board.jsonl)
Файл общей шины сообщений: \`${pathExample}/board.jsonl\`
Формат JSON Lines (каждая запись — отдельная строка):
\`\`\`json
{
  "seq": 1,
  "agent": "${agentName}",
  "text": "@coordinator Задача принята в работу",
  "time": "2026-11-16 12:00:00",
  "kind": "post",
  "channel": "main",
  "mentions": ["@coordinator"],
  "seq_refs": []
}
\`\`\`

## 2. Поведение агента
1. Читайте сообщения с номером больше последнего обработанного (\`seq > last_seq\`).
2. При обнаружении упоминания \`@${agentName}\` или \`@all\` немедленно приступайте к задаче.
3. Логируйте свои шаги глаголами первого лица настоящего времени:
   * Выполняю
   * Анализирую
   * Редактирую
   * Создаю
   * Читаю
   * Отвечаю
4. По готовности отправьте сообщение в \`board.jsonl\` с тегом адресата (@coordinator или следующий агент).`;
  };

  const handleCopy = async () => {
    const text = generatePrompt();
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <dialog
      ref={dialogRef}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      className="backdrop:bg-black/70 backdrop:backdrop-blur-sm rounded-2xl p-0 border shadow-2xl max-w-2xl w-full text-left overflow-hidden outline-none"
      style={{
        backgroundColor: "var(--bg-panel)",
        borderColor: "var(--border-subtle)",
        color: "var(--text-primary)",
      }}
    >
      <div
        className="px-5 py-4 border-b flex items-center justify-between gap-3 shrink-0"
        style={{ borderColor: "var(--border-subtle)" }}
      >
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
            style={{ backgroundColor: "var(--accent-soft)", color: "var(--accent)" }}
          >
            <Plug className="w-4 h-4" strokeWidth={1.5} />
          </div>
          <div>
            <h2 className="text-sm font-semibold tracking-tight" style={{ color: "var(--text-primary)" }}>
              Подключение агента к SwarmGraph
            </h2>
            <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
              Скопируйте системный промпт в любой CLI-чат или среду для включения в рой
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors cursor-pointer"
          style={{ color: "var(--text-muted)" }}
        >
          <X className="w-4 h-4" strokeWidth={1.5} />
        </button>
      </div>

      <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto scroller">
        <div className="flex items-center gap-2 p-1 rounded-xl border" style={{ backgroundColor: "var(--bg-elevated)", borderColor: "var(--border-subtle)" }}>
          {(
            [
              { id: "claude", label: "Claude Code", badge: "Anthropic", icon: Sparkles },
              { id: "codex", label: "OpenAI Codex", badge: "Codex CLI", icon: Terminal },
              { id: "custom", label: "Кастомный агент", badge: "Any LLM / Bot", icon: Layers },
            ] as const
          ).map((t) => {
            const active = platform === t.id;
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setPlatform(t.id)}
                className="flex-1 py-2 px-3 rounded-lg text-xs font-medium flex items-center justify-center gap-2 transition-all cursor-pointer min-w-0"
                style={{
                  backgroundColor: active ? "var(--accent)" : "transparent",
                  color: active ? "#ffffff" : "var(--text-muted)",
                }}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" strokeWidth={1.5} />
                <span className="truncate">{t.label}</span>
              </button>
            );
          })}
        </div>

        {platform === "custom" && (
          <div
            className="p-3 rounded-xl border space-y-2.5"
            style={{ backgroundColor: "var(--bg-elevated)", borderColor: "var(--border-subtle)" }}
          >
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-medium block mb-1" style={{ color: "var(--text-secondary)" }}>
                  Имя в рое (@agent)
                </label>
                <input
                  type="text"
                  value={customAgentName}
                  onChange={(e) => setCustomAgentName(e.target.value.toLowerCase().replace(/\s+/g, "-"))}
                  placeholder="например, qa-specialist"
                  className="w-full h-8 px-2.5 rounded-lg border text-xs font-mono outline-none"
                  style={{
                    backgroundColor: "var(--bg-panel)",
                    borderColor: "var(--border-subtle)",
                    color: "var(--text-primary)",
                  }}
                />
              </div>

              <div>
                <label className="text-[11px] font-medium block mb-1" style={{ color: "var(--text-secondary)" }}>
                  Роль / Назначение
                </label>
                <input
                  type="text"
                  value={customRole}
                  onChange={(e) => setCustomRole(e.target.value)}
                  placeholder="например, Проверка качества"
                  className="w-full h-8 px-2.5 rounded-lg border text-xs outline-none"
                  style={{
                    backgroundColor: "var(--bg-panel)",
                    borderColor: "var(--border-subtle)",
                    color: "var(--text-primary)",
                  }}
                />
              </div>
            </div>
          </div>
        )}

        <div
          className="p-3 rounded-xl border flex items-start gap-2.5 text-xs leading-relaxed"
          style={{ backgroundColor: "var(--bg-elevated)", borderColor: "var(--border-subtle)" }}
        >
          <HelpCircle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "var(--accent)" }} strokeWidth={1.5} />
          <div className="space-y-1">
            <span className="font-semibold block" style={{ color: "var(--text-primary)" }}>
              Как это работает:
            </span>
            <p style={{ color: "var(--text-secondary)" }}>
              Скопируйте промпт ниже и вставьте его в чат нового агента (Claude Code в терминале, Codex CLI или системный промпт кастомного скрипта). Агент автоматически подключится к общей шине <code className="px-1 py-0.5 rounded bg-black/30 font-mono text-[10px]">board.jsonl</code> и начнет отображаться на интерактивном графе SwarmGraph в реальном времени.
            </p>
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium" style={{ color: "var(--text-primary)" }}>
              Готовый системный промпт для копирования:
            </span>
            <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
              {platform === "claude" ? "Для CLAUDE.md или консоли Claude" : platform === "codex" ? "Для OpenAI Codex CLI" : "Для любого внешнего агента"}
            </span>
          </div>

          <pre
            className="p-3.5 rounded-xl border text-[11px] font-mono whitespace-pre-wrap break-words leading-relaxed max-h-64 overflow-y-auto scroller select-text"
            style={{
              backgroundColor: "#0d0f17",
              borderColor: "var(--border-subtle)",
              color: "#e2e8f0",
            }}
          >
            {generatePrompt()}
          </pre>
        </div>
      </div>

      <div
        className="px-5 py-3.5 border-t flex items-center justify-between gap-3 shrink-0"
        style={{ backgroundColor: "var(--bg-elevated)", borderColor: "var(--border-subtle)" }}
      >
        <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
          {copied ? "✓ Скопировано в буфер обмена!" : "Нажмите кнопку, чтобы скопировать весь текст промпта"}
        </span>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-8 px-3 rounded-lg text-xs font-medium border hover:bg-white/5 transition-colors cursor-pointer"
            style={{ borderColor: "var(--border-subtle)", color: "var(--text-secondary)" }}
          >
            Закрыть
          </button>

          <button
            type="button"
            onClick={handleCopy}
            className="h-8 px-4 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
            style={{
              backgroundColor: copied ? "#16a34a" : "var(--accent)",
              color: "#ffffff",
            }}
          >
            {copied ? <Check className="w-3.5 h-3.5" strokeWidth={2} /> : <Copy className="w-3.5 h-3.5" strokeWidth={1.5} />}
            <span>{copied ? "Скопировано!" : "Скопировать системный промпт"}</span>
          </button>
        </div>
      </div>
    </dialog>
  );
}
