import { describe, expect, it } from "vitest";
import {
  getActionVerb,
  getExtensionColor,
  getStepActions,
  localizeDetail,
  parseDiffStats,
} from "./InspectorPanel";
import type { ToolAction, TranscriptStep } from "../types";

describe("InspectorPanel Step Actions & Formats", () => {
  it("correctly parses diff stats for +N -M", () => {
    expect(parseDiffStats("+218 -0")).toEqual({ added: "+218", removed: "-0" });
    expect(parseDiffStats("+51 -2")).toEqual({ added: "+51", removed: "-2" });
    expect(parseDiffStats("+10")).toEqual({ added: "+10", removed: undefined });
    expect(parseDiffStats("-5")).toEqual({ added: undefined, removed: "-5" });
    expect(parseDiffStats("")).toBeNull();
    expect(parseDiffStats(undefined)).toBeNull();
  });

  it("returns correct color tokens for file extensions", () => {
    expect(getExtensionColor("ts")).toBe("#3b82f6"); // синий
    expect(getExtensionColor("TSX")).toBe("#3b82f6");
    expect(getExtensionColor("py")).toBe("#22c55e"); // зеленый
    expect(getExtensionColor("rs")).toBe("#f97316"); // оранжевый
    expect(getExtensionColor("json")).toBe("#eab308"); // желтый
    expect(getExtensionColor("unknown")).toBe("#94a3b8"); // дефолтный серый
  });

  it("correctly maps Russian first-person present-tense and English action verbs", () => {
    const actions: Array<{ kind: ToolAction["kind"]; ru: string; en: string }> = [
      { kind: "create", ru: "Создаю", en: "Created" },
      { kind: "edit", ru: "Редактирую", en: "Edited" },
      { kind: "read", ru: "Читаю", en: "Ran" },
      { kind: "run", ru: "Выполняю", en: "Ran" },
      { kind: "think", ru: "Анализирую", en: "Analyzed" },
      { kind: "user", ru: "Промпт", en: "Prompt" },
      { kind: "generic", ru: "Отвечаю", en: "Responded" },
      { kind: "search", ru: "Ищу", en: "Ran" },
    ];

    for (const item of actions) {
      const act: ToolAction = {
        kind: item.kind,
        verb_en: item.en,
        verb_ru: item.ru,
        detail: "test",
      };
      expect(getActionVerb(act, "ru")).toBe(item.ru);
      expect(getActionVerb(act, "en")).toBe(item.en);
    }
  });

  it("localizes action details into Russian", () => {
    expect(localizeDetail("read java-runtime.ts", "ru", "Ran", "Читаю")).toBe("java-runtime.ts");
    expect(localizeDetail("check top of papermc-api.ts", "ru", "Ran", "Выполняю")).toBe(
      "проверка начала papermc-api.ts"
    );
    expect(localizeDetail("read downloadCore in papermc-api.ts", "ru", "Ran", "Выполняю")).toBe(
      "чтение downloadCore в papermc-api.ts"
    );
    expect(localizeDetail("search response mapping", "ru", "Ran", "Ищу")).toBe("поиск ответа маппинга");
    expect(localizeDetail("Ran read java-runtime.ts", "en", "Ran")).toBe("read java-runtime.ts");
  });

  it("uses pre-parsed step actions if available and adapts them to present tense", () => {
    const step: TranscriptStep = {
      step_index: 1,
      source: "MODEL",
      step_type: "PLANNER_RESPONSE",
      status: "DONE",
      created_at: "2026-11-15T22:00:00Z",
      content_preview: "Created file",
      tool_names: ["write_file"],
      input_tokens: 100,
      output_tokens: 50,
      actions: [
        {
          kind: "create",
          verb_en: "Created",
          verb_ru: "Создал",
          file_name: "server-scanner.ts",
          file_ext: "TS",
          diff_stats: "+218 -0",
          detail: "Created server-scanner.ts",
        },
      ],
    };

    const actions = getStepActions(step);
    expect(actions).toHaveLength(1);
    expect(actions[0].verb_en).toBe("Created");
    expect(actions[0].file_name).toBe("server-scanner.ts");
    expect(actions[0].diff_stats).toBe("+218 -0");
    expect(getActionVerb(actions[0], "ru")).toBe("Создаю");
  });

  it("falls back gracefully when step.actions is undefined with first-person verbs", () => {
    const userStep: TranscriptStep = {
      step_index: 0,
      source: "USER_EXPLICIT",
      step_type: "USER_INPUT",
      status: "DONE",
      created_at: "2026-11-15T22:00:00Z",
      content_preview: "Поправь шаги в интерфейсе",
      tool_names: [],
      input_tokens: 50,
      output_tokens: 0,
    };
    const userActions = getStepActions(userStep);
    expect(userActions).toHaveLength(1);
    expect(userActions[0].kind).toBe("user");
    expect(userActions[0].verb_en).toBe("Prompt");
    expect(userActions[0].verb_ru).toBe("Промпт");

    const toolStep: TranscriptStep = {
      step_index: 2,
      source: "MODEL",
      step_type: "PLANNER_RESPONSE",
      status: "DONE",
      created_at: "2026-11-15T22:01:00Z",
      content_preview: "",
      tool_names: ["read_file"],
      input_tokens: 200,
      output_tokens: 30,
    };
    const toolActions = getStepActions(toolStep);
    expect(toolActions).toHaveLength(1);
    expect(toolActions[0].kind).toBe("read");
    expect(toolActions[0].verb_ru).toBe("Читаю");

    const responseStep: TranscriptStep = {
      step_index: 3,
      source: "MODEL",
      step_type: "PLANNER_RESPONSE",
      status: "DONE",
      created_at: "2026-11-15T22:02:00Z",
      content_preview: "Готово, все проверено.",
      tool_names: [],
      input_tokens: 150,
      output_tokens: 40,
    };
    const responseActions = getStepActions(responseStep);
    expect(responseActions).toHaveLength(1);
    expect(responseActions[0].kind).toBe("generic");
    expect(responseActions[0].verb_ru).toBe("Отвечаю");
  });
});
