import { describe, expect, it } from "vitest";
import { isMostlyEnglish } from "./formatters";
import { buildSwarmGraph, getReplayFeedSlice } from "./graphBuilder";
import type { SessionDetail } from "../types";

const MOCK_DETAIL: SessionDetail = {
  summary: {
    id: "conv-1",
    title: "Тестовый рой",
    has_swarm: true,
    is_live: true,
    created_at: "2026-11-11T10:00:00Z",
    updated_at_ms: 1000,
    member_count: 4,
    subagent_count: 1,
    board_count: 3,
    channels: ["main"],
    root_path: "F:\\tmp\\conv-1",
  },
  swarm_meta: {
    version: 1,
    backend: "local",
    swarm_id: "conv-1",
    created_at: "2026-11-11T10:00:00Z",
  },
  members: [
    {
      name: "coordinator",
      conversation_id: "conv-1",
      role: "coordinator",
      phase: "RUNNING",
      desired_state: "RUNNING",
      desired_model: "gemini-3.8-flash-medium",
      applied_model: "gemini-3.8-flash-medium",
      model: "gemini-3.8-flash-medium",
      workspace_mode: "inherit",
      wake_mode: "mentions",
      wait_since: 0,
      last_read_seq: 3,
      killed: false,
      channels: ["main"],
    },
    {
      name: "worker-a",
      conversation_id: "conv-2",
      role: "worker",
      phase: "RUNNING",
      desired_state: "RUNNING",
      desired_model: "gemini-3.8-flash-medium",
      applied_model: "gemini-3.8-flash-medium",
      model: "gemini-3.8-flash-medium",
      workspace_mode: "inherit",
      wake_mode: "working",
      wait_since: 0,
      last_read_seq: 2,
      killed: false,
      channels: ["main"],
    },
    {
      name: "verifier",
      conversation_id: "conv-3",
      role: "worker",
      phase: "RUNNING",
      desired_state: "RUNNING",
      desired_model: "gemini-3.8-flash-medium",
      applied_model: "gemini-3.8-flash-medium",
      model: "gemini-3.8-flash-medium",
      workspace_mode: "inherit",
      wake_mode: "mentions",
      wait_since: 0,
      last_read_seq: 3,
      killed: false,
      channels: ["main"],
    },
    {
      name: "worker-idle",
      conversation_id: "conv-4",
      role: "worker",
      phase: "STOPPED",
      desired_state: "STOPPED",
      desired_model: "gemini-3.8-flash-medium",
      applied_model: "gemini-3.8-flash-medium",
      model: "gemini-3.8-flash-medium",
      workspace_mode: "inherit",
      wake_mode: "waiting",
      wait_since: 0,
      last_read_seq: 0,
      killed: false,
      channels: ["main"],
    },
  ],
  board: [
    {
      seq: 1,
      agent: "coordinator",
      text: "@worker-a start",
      time: "2026-11-11 10:00:01",
      kind: "brief",
      request_id: "r1",
      channel: "main",
      mentions: ["worker-a"],
      seq_refs: [],
    },
    {
      seq: 2,
      agent: "worker-a",
      text: "@verifier check #1",
      time: "2026-11-11 10:00:05",
      kind: "post",
      request_id: "r2",
      channel: "main",
      mentions: ["verifier"],
      seq_refs: [1],
    },
    {
      seq: 3,
      agent: "verifier",
      text: "@coordinator verified",
      time: "2026-11-11 10:00:10",
      kind: "post",
      request_id: "r3",
      channel: "main",
      mentions: ["coordinator"],
      seq_refs: [],
    },
  ],
  subagents: [
    {
      conversation_id: "sub-1",
      type_name: "research",
      role: "Repo Auditor",
      state: "SUBAGENT_STATE_ALIVE",
      spawn_step_index: 5,
      parent_conversation_id: "conv-2",
    },
  ],
  transcripts: {},
};

describe("buildSwarmGraph & replay", () => {
  it("builds nodes, mention edges and subagent spawn edge", () => {
    const graph = buildSwarmGraph(MOCK_DETAIL, {
      replaySeq: null,
      activeChannel: "*",
      settings: { appearOnStartOnly: false },
    });
    expect(graph.nodes).toHaveLength(5);
    expect(graph.edges).toHaveLength(4);
    const spawnEdge = graph.edges.find((e) => e.kind === "spawn");
    expect(spawnEdge?.source).toBe("worker-a");
  });

  it("identifies promptSource and handoffTarget accurately", () => {
    const graph = buildSwarmGraph(MOCK_DETAIL, {
      replaySeq: null,
      activeChannel: "*",
      settings: { appearOnStartOnly: false },
    });
    const workerA = graph.nodes.find((n) => n.id === "worker-a");
    expect(workerA?.promptSource).toBe("coordinator");
    expect(workerA?.handoffTarget).toBe("verifier");

    const verifier = graph.nodes.find((n) => n.id === "verifier");
    expect(verifier?.promptSource).toBe("worker-a");
    expect(verifier?.handoffTarget).toBe("coordinator");
  });

  it("filters unstarted agents when appearOnStartOnly is true", () => {
    const graph = buildSwarmGraph(MOCK_DETAIL, {
      replaySeq: 1,
      activeChannel: "*",
      settings: { appearOnStartOnly: true },
    });
    const ids = graph.nodes.map((n) => n.id);
    expect(ids).toContain("coordinator");
    expect(ids).toContain("worker-a");
    // verifier еще не стартовал на seq=1
    expect(ids).not.toContain("verifier");
    expect(ids).not.toContain("worker-idle");
  });

  it("filters only active work when onlyActiveWork is true", () => {
    const graph = buildSwarmGraph(MOCK_DETAIL, {
      replaySeq: null,
      activeChannel: "*",
      settings: { onlyActiveWork: true },
    });
    // worker-a в режиме wake_mode: "working", coordinator и subagent активны
    const ids = graph.nodes.map((n) => n.id);
    expect(ids).toContain("worker-a");
    expect(ids).not.toContain("worker-idle");
  });

  it("slices graph and feed at replaySeq=1", () => {
    const graph = buildSwarmGraph(MOCK_DETAIL, {
      replaySeq: 1,
      activeChannel: "*",
      settings: { appearOnStartOnly: false },
    });
    const mentionEdges = graph.edges.filter((e) => e.kind === "mention");
    expect(mentionEdges).toHaveLength(1);
    expect(mentionEdges[0].id).toBe("coordinator->worker-a");
    expect(getReplayFeedSlice(MOCK_DETAIL.board, 1)).toHaveLength(1);
  });

  it("detects english vs russian text accurately", () => {
    expect(
      isMostlyEnglish(
        "Please inspect the routing configuration and report back.",
      ),
    ).toBe(true);
    expect(
      isMostlyEnglish("Проверь настройки маршрутизации и отправь отчёт"),
    ).toBe(false);
  });

  it("arranges nodes into compact matrix without overlap when compactLayout is true", () => {
    const customPositions = {
      "worker-a": { x: 9999, y: 9999 },
    };
    const standardGraph = buildSwarmGraph(MOCK_DETAIL, {
      replaySeq: null,
      activeChannel: "*",
      customPositions,
      settings: { appearOnStartOnly: false, compactLayout: false },
    });
    // В стандартном режиме сохраняются пользовательские координаты
    expect(standardGraph.nodes.find((n) => n.id === "worker-a")?.x).toBe(9999);

    const compactGraph = buildSwarmGraph(MOCK_DETAIL, {
      replaySeq: null,
      activeChannel: "*",
      customPositions,
      settings: { appearOnStartOnly: false, compactLayout: true },
    });
    const workerA = compactGraph.nodes.find((n) => n.id === "worker-a");
    // В компактном режиме пользовательские разбросанные координаты сбрасываются в аккуратную матрицу
    expect(workerA?.x).not.toBe(9999);
    expect(workerA?.y).toBeLessThan(500);

    // Проверяем, что узлы в одном ряду не перекрываются (минимальный отступ между левыми краями >= 216px при ширине 200px)
    const coordinator = compactGraph.nodes.find((n) => n.id === "coordinator");
    expect(coordinator?.y).toBe(40);
  });
});
