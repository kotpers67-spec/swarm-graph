import type {
  BoardMessage,
  ComputedGraph,
  GraphEdge,
  GraphNode,
  GraphNodeKind,
  SessionDetail,
  SettingsState,
} from "../types";

const NODE_W = 200;
const NODE_H = 82;

function classifyMemberKind(role: string, name: string): GraphNodeKind {
  if (role === "coordinator" || name === "coordinator") return "coordinator";
  if (name === "verifier" || name.startsWith("verifier")) return "verifier";
  if (
    name === "monitor" ||
    name.startsWith("monitor") ||
    name === "narrator" ||
    name.startsWith("narrator")
  ) {
    return "utility";
  }
  return "worker";
}

function mapStatus(
  killed: boolean,
  wakeMode: string,
  isWorkingAtCursor: boolean,
): GraphNode["status"] {
  if (killed) return "killed";
  if (isWorkingAtCursor || wakeMode === "working") return "working";
  return "waiting";
}

export function buildSwarmGraph(
  detail: SessionDetail | null,
  options: {
    replaySeq: number | null;
    activeChannel: string;
    customPositions?: Record<string, { x: number; y: number }>;
    settings?: Partial<SettingsState>;
  },
): ComputedGraph {
  if (!detail) return { nodes: [], edges: [] };

  const {
    replaySeq,
    activeChannel,
    customPositions = {},
    settings = {},
  } = options;

  const appearOnStartOnly = settings.appearOnStartOnly ?? true;
  const onlyActiveWork = settings.onlyActiveWork ?? false;
  const isCompact = settings.compactLayout ?? false;

  const filteredBoard = detail.board.filter((msg) => {
    const channelOk =
      activeChannel === "*" ||
      msg.channel === activeChannel ||
      msg.channel === "main";
    const seqOk = replaySeq === null || msg.seq <= replaySeq;
    return channelOk && seqOk;
  });

  const lastMessage = filteredBoard[filteredBoard.length - 1] ?? null;

  const sentCounts = new Map<string, number>();
  const recvCounts = new Map<string, number>();
  const edgeMap = new Map<string, GraphEdge>();
  const firstActiveSeqMap = new Map<string, number>();
  const promptSourceMap = new Map<string, string>();
  const handoffTargetMap = new Map<string, string>();

  const knownMemberNames = new Set(detail.members.map((m) => m.name));

  // Анализируем всю историю сообщений для выявления цепочек «от кого промпт» и «кому задача»
  for (const msg of filteredBoard) {
    sentCounts.set(msg.agent, (sentCounts.get(msg.agent) ?? 0) + 1);

    if (!firstActiveSeqMap.has(msg.agent)) {
      firstActiveSeqMap.set(msg.agent, msg.seq);
    }

    const targets: string[] = [];
    for (const m of msg.mentions) {
      if (m === "all") {
        for (const memberName of knownMemberNames) {
          if (memberName !== msg.agent) targets.push(memberName);
        }
      } else if (knownMemberNames.has(m)) {
        targets.push(m);
      } else {
        for (const memberName of knownMemberNames) {
          if (memberName.startsWith(`${m}-`)) targets.push(memberName);
        }
      }
    }

    for (const target of targets) {
      if (target === msg.agent) continue;
      recvCounts.set(target, (recvCounts.get(target) ?? 0) + 1);

      if (!firstActiveSeqMap.has(target)) {
        firstActiveSeqMap.set(target, msg.seq);
      }
      if (!promptSourceMap.has(target)) {
        promptSourceMap.set(target, msg.agent);
      }
      // Последний агент, которому передана задача от этого автора
      handoffTargetMap.set(msg.agent, target);

      const edgeId = `${msg.agent}->${target}`;
      const existing = edgeMap.get(edgeId);
      const isCurrent = lastMessage !== null && lastMessage.seq === msg.seq;
      const isInitialPrompt = promptSourceMap.get(target) === msg.agent;

      if (existing) {
        existing.count += 1;
        existing.seqs.push(msg.seq);
        if (isCurrent) existing.isActiveAtCursor = true;
        existing.label =
          existing.seqs.length > 2
            ? `${existing.seqs[0]}..${existing.seqs[existing.seqs.length - 1]} (${existing.count})`
            : existing.seqs.map((s) => `${s}`).join(", ");
      } else {
        edgeMap.set(edgeId, {
          id: edgeId,
          source: msg.agent,
          target,
          kind: "mention",
          handoffRole: isInitialPrompt ? "prompt" : "handoff",
          count: 1,
          seqs: [msg.seq],
          isActiveAtCursor: isCurrent,
          label: `${msg.seq}`,
        });
      }
    }
  }

  const rawNodes: GraphNode[] = [];
  const convToNodeId = new Map<string, string>();

  // Если сессия без явных участников роя — создаём корневой узел
  if (detail.members.length === 0) {
    const rootId = "root-session";
    convToNodeId.set(detail.summary.id, rootId);
    const pos = (isCompact ? null : customPositions[rootId]) ?? {
      x: 420,
      y: isCompact ? 50 : 80,
    };
    rawNodes.push({
      id: rootId,
      label: detail.summary.title || "Основной агент",
      subtitle: "координатор сессии",
      kind: "coordinator",
      conversationId: detail.summary.id,
      model: "Antigravity",
      status: detail.summary.is_live ? "working" : "waiting",
      sentCount: detail.transcripts[detail.summary.id]?.length ?? 0,
      receivedCount: 0,
      isActiveAtCursor: true,
      firstActiveSeq: 0,
      promptSource: null,
      handoffTarget: null,
      hasStarted: true,
      platform: detail.platform ?? detail.summary.platform ?? "antigravity",
      x: pos.x,
      y: pos.y,
    });
  } else {
    const coordinators = detail.members.filter(
      (m) => classifyMemberKind(m.role, m.name) === "coordinator",
    );
    const workers = detail.members.filter(
      (m) => classifyMemberKind(m.role, m.name) === "worker",
    );
    const verifiers = detail.members.filter(
      (m) => classifyMemberKind(m.role, m.name) === "verifier",
    );
    const utilities = detail.members.filter(
      (m) => classifyMemberKind(m.role, m.name) === "utility",
    );

    const cols = isCompact ? 5 : 4;
    const gapX = isCompact ? 216 : 230;
    const gapY = isCompact ? 104 : 124;

    const placeGrid = (
      list: typeof detail.members,
      startY: number,
      centerX = 460,
      gridCols = cols,
    ) => {
      list.forEach((m, idx) => {
        const row = Math.floor(idx / gridCols);
        const col = idx % gridCols;
        const rowLen = Math.min(gridCols, list.length - row * gridCols);
        const totalW = Math.max(0, (rowLen - 1) * gapX);
        const rowStartX = centerX - totalW / 2;

        convToNodeId.set(m.conversation_id, m.name);
        const kind = classifyMemberKind(m.role, m.name);
        const isCurrentActor =
          lastMessage !== null &&
          (lastMessage.agent === m.name ||
            lastMessage.mentions.includes(m.name) ||
            lastMessage.mentions.includes("all"));

        const firstSeqFromBoard = firstActiveSeqMap.get(m.name) ?? null;
        const firstSeq =
          kind === "coordinator"
            ? 0
            : (firstSeqFromBoard ??
              (replaySeq === null && m.last_read_seq > 0 ? m.last_read_seq : null));

        const hasStarted =
          kind === "coordinator" ||
          (replaySeq !== null
            ? firstSeqFromBoard !== null && firstSeqFromBoard <= replaySeq
            : (firstSeq !== null || m.phase === "RUNNING" || m.wake_mode === "working"));

        const pos = (isCompact ? null : customPositions[m.name]) ?? {
          x: rowStartX + col * gapX,
          y: startY + row * gapY,
        };

        rawNodes.push({
          id: m.name,
          label: m.name,
          subtitle:
            kind === "coordinator"
              ? "координатор"
              : kind === "verifier"
                ? "верификатор"
                : kind === "utility"
                  ? "сервис роя"
                  : "воркер",
          kind,
          conversationId: m.conversation_id,
          model: m.applied_model || m.model || m.desired_model || "auto",
          status: mapStatus(
            m.killed,
            m.wake_mode,
            isCurrentActor && replaySeq !== null,
          ),
          sentCount: sentCounts.get(m.name) ?? 0,
          receivedCount: recvCounts.get(m.name) ?? 0,
          isActiveAtCursor: isCurrentActor,
          firstActiveSeq: firstSeq,
          promptSource: promptSourceMap.get(m.name) ?? null,
          handoffTarget: handoffTargetMap.get(m.name) ?? null,
          hasStarted,
          platform: detail.platform ?? detail.summary.platform ?? "antigravity",
          x: pos.x,
          y: pos.y,
        });
      });
    };

    let currentY = isCompact ? 40 : 60;

    if (coordinators.length > 0) {
      placeGrid(coordinators, currentY, 460);
      const rows = Math.ceil(coordinators.length / cols);
      currentY += rows * gapY + (isCompact ? 12 : 24);
    }

    if (utilities.length > 0) {
      placeGrid(utilities, currentY, 460);
      const rows = Math.ceil(utilities.length / cols);
      currentY += rows * gapY + (isCompact ? 12 : 24);
    }

    if (workers.length > 0) {
      placeGrid(workers, currentY, 460);
      const rows = Math.ceil(workers.length / cols);
      currentY += rows * gapY + (isCompact ? 12 : 24);
    }

    if (verifiers.length > 0) {
      placeGrid(verifiers, currentY, 460);
      const rows = Math.ceil(verifiers.length / cols);
      currentY += rows * gapY + (isCompact ? 12 : 24);
    }
  }

  // Вложенные субагенты
  const subCols = isCompact ? 5 : 4;
  const subGapX = isCompact ? 216 : 230;
  const subGapY = isCompact ? 104 : 124;
  const maxMemberY = rawNodes.reduce((acc, n) => Math.max(acc, n.y), 0);
  const subBaseY =
    rawNodes.length > 0
      ? maxMemberY + subGapY + (isCompact ? 12 : 24)
      : isCompact
        ? 50
        : 80;

  detail.subagents.forEach((sub, idx) => {
    const row = Math.floor(idx / subCols);
    const col = idx % subCols;
    const rowLen = Math.min(subCols, detail.subagents.length - row * subCols);
    const rowStartX = 460 - (Math.max(0, rowLen - 1) * subGapX) / 2;

    const nodeId = `sub:${sub.conversation_id.slice(0, 8)}`;
    const parentId =
      convToNodeId.get(sub.parent_conversation_id) ?? rawNodes[0]?.id;
    const pos = (isCompact ? null : customPositions[nodeId]) ?? {
      x: rowStartX + col * subGapX,
      y: subBaseY + row * subGapY,
    };

    const hasStarted =
      replaySeq !== null
        ? sub.spawn_step_index <= replaySeq
        : sub.state.includes("ALIVE") || sub.spawn_step_index > 0;

    rawNodes.push({
      id: nodeId,
      label: sub.role || sub.type_name,
      subtitle: `субагент · ${sub.type_name}`,
      kind: "subagent",
      conversationId: sub.conversation_id,
      model: "subagent",
      status: sub.state.includes("ALIVE") ? "alive" : "waiting",
      sentCount: detail.transcripts[sub.conversation_id]?.length ?? 0,
      receivedCount: 0,
      isActiveAtCursor: false,
      firstActiveSeq: sub.spawn_step_index,
      promptSource: parentId ?? null,
      handoffTarget: null,
      hasStarted,
      platform: detail.platform ?? detail.summary.platform ?? "antigravity",
      x: pos.x,
      y: pos.y,
    });

    if (parentId) {
      edgeMap.set(`spawn:${parentId}->${nodeId}`, {
        id: `spawn:${parentId}->${nodeId}`,
        source: parentId,
        target: nodeId,
        kind: "spawn",
        handoffRole: "spawn",
        count: 1,
        seqs: [sub.spawn_step_index],
        isActiveAtCursor: false,
        label: `порождён ${sub.spawn_step_index}`,
      });
    }
  });

  // Применяем фильтры:
  // 1. «Появление агента только после старта» (appearOnStartOnly)
  // 2. «Только активные работы» (onlyActiveWork)
  const finalNodes = rawNodes.filter((node) => {
    if (node.kind === "coordinator") return true;

    if (appearOnStartOnly && !node.hasStarted) {
      return false;
    }

    if (onlyActiveWork) {
      const isWorking =
        node.status === "working" || node.status === "alive";
      const isRecent =
        node.firstActiveSeq !== null &&
        filteredBoard.length > 0 &&
        filteredBoard.slice(-4).some(
          (m) =>
            m.agent === node.id ||
            m.mentions.includes(node.id) ||
            m.mentions.includes("all"),
        );
      return isWorking || isRecent;
    }

    return true;
  });

  const activeNodeIds = new Set(finalNodes.map((n) => n.id));

  // Фильтруем рёбра, оставляя только связи между видимыми узлами
  const finalEdges = Array.from(edgeMap.values()).filter(
    (e) => activeNodeIds.has(e.source) && activeNodeIds.has(e.target),
  );

  return {
    nodes: finalNodes,
    edges: finalEdges,
  };
}

export function getReplayFeedSlice(
  board: BoardMessage[],
  replaySeq: number | null,
  activeChannel?: string,
): BoardMessage[] {
  return board.filter((m) => {
    const channelOk =
      !activeChannel ||
      activeChannel === "*" ||
      m.channel === activeChannel ||
      m.channel === "main";
    const seqOk = replaySeq === null || m.seq <= replaySeq;
    return channelOk && seqOk;
  });
}

export const GRAPH_NODE_WIDTH = NODE_W;
export const GRAPH_NODE_HEIGHT = NODE_H;
