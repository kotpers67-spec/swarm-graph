import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowDownRight,
  ArrowUpRight,
  Boxes,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Pause,
  Play,
  Radio,
  RotateCcw,
  Sparkles,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { formatStatusRu, shortModelName } from "../lib/formatters";
import { GRAPH_NODE_HEIGHT, GRAPH_NODE_WIDTH } from "../lib/graphBuilder";
import type { BoardMessage, ComputedGraph, SettingsState, StylePreset } from "../types";

interface GraphCanvasProps {
  graph: ComputedGraph;
  preset: StylePreset;
  settings: SettingsState;
  selectedNodeId: string | null;
  onSelectNode: (id: string) => void;
  onUpdateNodePosition: (id: string, x: number, y: number) => void;
  onResetLayout: () => void;
  onToggleCompactLayout?: () => void;
  // Replay controls
  board: BoardMessage[];
  replaySeq: number | null;
  isPlaying: boolean;
  playbackSpeed: number;
  onSetReplaySeq: (seq: number | null) => void;
  onTogglePlay: () => void;
  onStepReplay: (delta: -1 | 1) => void;
  onChangeSpeed: (speed: number) => void;
}

export function GraphCanvas({
  graph,
  preset,
  settings,
  selectedNodeId,
  onSelectNode,
  onUpdateNodePosition,
  onResetLayout,
  onToggleCompactLayout,
  board,
  replaySeq,
  isPlaying,
  playbackSpeed,
  onSetReplaySeq,
  onTogglePlay,
  onStepReplay,
  onChangeSpeed,
}: GraphCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pan, setPan] = useState({ x: 30, y: 20 });
  const [zoom, setZoom] = useState(1);
  const [draggingCanvas, setDraggingCanvas] = useState<{
    startX: number;
    startY: number;
    origPanX: number;
    origPanY: number;
  } | null>(null);
  const [draggingNode, setDraggingNode] = useState<{
    id: string;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  } | null>(null);

  const fitView = () => {
    const el = containerRef.current;
    if (!el || graph.nodes.length === 0) {
      setPan({ x: 30, y: 20 });
      setZoom(1);
      return;
    }
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const n of graph.nodes) {
      minX = Math.min(minX, n.x);
      minY = Math.min(minY, n.y);
      maxX = Math.max(maxX, n.x + GRAPH_NODE_WIDTH);
      maxY = Math.max(maxY, n.y + GRAPH_NODE_HEIGHT);
    }
    const gw = Math.max(200, maxX - minX);
    const gh = Math.max(120, maxY - minY);
    const rect = el.getBoundingClientRect();
    const availW = Math.max(200, rect.width - 80);
    const availH = Math.max(200, rect.height - 130);
    const nextZoom = Math.max(
      0.45,
      Math.min(1.15, Math.min(availW / gw, availH / gh)),
    );
    setZoom(nextZoom);
    setPan({
      x: (rect.width - gw * nextZoom) / 2 - minX * nextZoom,
      y: (rect.height - 72 - gh * nextZoom) / 2 - minY * nextZoom,
    });
  };

  useEffect(() => {
    fitView();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graph.nodes.length, settings.compactLayout]);

  const handlePointerMove = (e: React.PointerEvent) => {
    if (draggingNode) {
      const dx = (e.clientX - draggingNode.startX) / zoom;
      const dy = (e.clientY - draggingNode.startY) / zoom;
      onUpdateNodePosition(
        draggingNode.id,
        draggingNode.origX + dx,
        draggingNode.origY + dy,
      );
      return;
    }
    if (draggingCanvas) {
      setPan({
        x: draggingCanvas.origPanX + (e.clientX - draggingCanvas.startX),
        y: draggingCanvas.origPanY + (e.clientY - draggingCanvas.startY),
      });
    }
  };

  const handlePointerUp = () => {
    setDraggingCanvas(null);
    setDraggingNode(null);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.08 : 0.92;
    setZoom((z) =>
      Math.max(0.35, Math.min(2.0, Number((z * factor).toFixed(3)))),
    );
  };

  const nodeMap = new Map(graph.nodes.map((n) => [n.id, n]));
  const minSeq = board.length > 0 ? board[0].seq : 0;
  const maxSeq = board.length > 0 ? board[board.length - 1].seq : 0;
  const effectiveSeq = replaySeq ?? maxSeq;
  const isLiveMode = replaySeq === null;

  // Длительность волновой анимации в зависимости от скорости в настройках
  const waveDuration =
    settings.animationSpeed === "fast"
      ? "1.0s"
      : settings.animationSpeed === "cinematic"
        ? "2.6s"
        : "1.6s";

  return (
    <section
      ref={containerRef}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      onWheel={handleWheel}
      onPointerDown={(e) => {
        if ((e.target as HTMLElement).closest("[data-graph-node]")) return;
        setDraggingCanvas({
          startX: e.clientX,
          startY: e.clientY,
          origPanX: pan.x,
          origPanY: pan.y,
        });
      }}
      className={`relative flex-1 min-w-0 min-h-0 overflow-hidden select-none cursor-grab active:cursor-grabbing ${
        settings.gridStyle === "blueprint" || preset === "blueprint"
          ? "canvas-grid-blueprint"
          : settings.gridStyle === "minimal"
            ? ""
            : "canvas-grid-dots"
      }`}
      style={{ backgroundColor: "var(--bg-app)" }}
    >
      {/* Панель управления масштабом */}
      <div
        className="absolute top-3 right-3 z-20 flex items-center gap-1 p-1 rounded-lg border shadow-sm backdrop-blur-md"
        style={{
          backgroundColor: "var(--bg-panel)",
          borderColor: "var(--border-subtle)",
        }}
      >
        <button
          type="button"
          onClick={() =>
            setZoom((z) => Math.max(0.35, Number((z - 0.15).toFixed(2))))
          }
          title="Уменьшить"
          className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-white/5 cursor-pointer"
          style={{ color: "var(--text-secondary)" }}
        >
          <ZoomOut className="w-3.5 h-3.5" strokeWidth={1.5} />
        </button>
        <span
          className="px-1.5 text-[11px] font-medium tabular-nums"
          style={{ color: "var(--text-muted)" }}
        >
          {Math.round(zoom * 100)}%
        </span>
        <button
          type="button"
          onClick={() =>
            setZoom((z) => Math.min(2.0, Number((z + 0.15).toFixed(2))))
          }
          title="Увеличить"
          className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-white/5 cursor-pointer"
          style={{ color: "var(--text-secondary)" }}
        >
          <ZoomIn className="w-3.5 h-3.5" strokeWidth={1.5} />
        </button>
        <button
          type="button"
          onClick={fitView}
          title="Вписать граф в экран"
          className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-white/5 cursor-pointer"
          style={{ color: "var(--text-secondary)" }}
        >
          <Maximize2 className="w-3.5 h-3.5" strokeWidth={1.5} />
        </button>
        <button
          type="button"
          onClick={() => {
            onToggleCompactLayout?.();
            setTimeout(fitView, 30);
          }}
          title={
            settings.compactLayout
              ? "Компактная группировка активна (кликните, чтобы развернуть)"
              : "Собрать всех субагентов и оркестр в компактную матрицу"
          }
          className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-white/5 cursor-pointer transition-colors"
          style={{
            color: settings.compactLayout
              ? "var(--accent)"
              : "var(--text-secondary)",
            backgroundColor: settings.compactLayout
              ? "var(--accent-soft)"
              : "transparent",
          }}
        >
          <Boxes
            className="w-3.5 h-3.5"
            strokeWidth={settings.compactLayout ? 2.2 : 1.5}
          />
        </button>
        <button
          type="button"
          onClick={() => {
            onResetLayout();
            setTimeout(fitView, 20);
          }}
          title="Сбросить позиции узлов"
          className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-white/5 cursor-pointer"
          style={{ color: "var(--text-secondary)" }}
        >
          <RotateCcw className="w-3.5 h-3.5" strokeWidth={1.5} />
        </button>
      </div>

      {/* Трансформируемая сцена графа */}
      <div
        className="absolute inset-0 origin-top-left"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
        }}
      >
        {/* SVG слой связей и волнообразных импульсов */}
        <svg
          className="overflow-visible pointer-events-none"
          width="1"
          height="1"
        >
          <defs>
            <marker
              id="arrow-default"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path
                d="M 0 1.5 L 8 5 L 0 8.5 z"
                fill="currentColor"
                style={{ color: "var(--border-strong)" }}
              />
            </marker>
            <marker
              id="arrow-active"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="7"
              markerHeight="7"
              orient="auto-start-reverse"
            >
              <path
                d="M 0 1.5 L 8 5 L 0 8.5 z"
                fill="currentColor"
                style={{ color: "var(--accent)" }}
              />
            </marker>
          </defs>

          {graph.edges.map((edge) => {
            const src = nodeMap.get(edge.source);
            const dst = nodeMap.get(edge.target);
            if (!src || !dst) return null;

            const sx = src.x + GRAPH_NODE_WIDTH / 2;
            const sy = src.y + GRAPH_NODE_HEIGHT / 2;
            const tx = dst.x + GRAPH_NODE_WIDTH / 2;
            const ty = dst.y + GRAPH_NODE_HEIGHT / 2;
            const cx = (sx + tx) / 2;
            const cy = Math.min(sy, ty) - 40;
            const pathD = `M ${sx} ${sy} Q ${cx} ${cy} ${tx} ${ty}`;

            const mx = 0.25 * sx + 0.5 * cx + 0.25 * tx;
            const my = 0.25 * sy + 0.5 * cy + 0.25 * ty;

            const highlighted =
              edge.isActiveAtCursor ||
              edge.source === selectedNodeId ||
              edge.target === selectedNodeId;

            return (
              <g key={edge.id}>
                {/* Фоновая линия связи */}
                <path
                  d={pathD}
                  fill="none"
                  stroke={
                    highlighted ? "var(--accent)" : "var(--border-strong)"
                  }
                  strokeWidth={
                    edge.isActiveAtCursor ? 2.6 : highlighted ? 2.0 : 1.3
                  }
                  strokeDasharray={edge.kind === "spawn" ? "5 4" : undefined}
                  markerEnd={
                    highlighted
                      ? "url(#arrow-active)"
                      : "url(#arrow-default)"
                  }
                  opacity={highlighted ? 1 : 0.7}
                />

                {/* Волнообразная пульсирующая волна к вызванному агенту */}
                {(edge.isActiveAtCursor ||
                  (highlighted && edge.handoffRole === "prompt")) && (
                  <g>
                    {/* Внешнее мягкое свечение волны */}
                    <circle r="12" fill="var(--accent)" opacity="0.32">
                      <animateMotion
                        path={pathD}
                        dur={waveDuration}
                        repeatCount="indefinite"
                      />
                    </circle>
                    {/* Ядро импульса */}
                    <circle r="5.5" fill="#ffffff">
                      <animateMotion
                        path={pathD}
                        dur={waveDuration}
                        repeatCount="indefinite"
                      />
                    </circle>
                    <circle r="3.5" fill="var(--accent)">
                      <animateMotion
                        path={pathD}
                        dur={waveDuration}
                        repeatCount="indefinite"
                      />
                    </circle>
                  </g>
                )}

                {/* Бейдж связи */}
                <g transform={`translate(${mx}, ${my})`}>
                  <rect
                    x={-Math.max(26, edge.label.length * 3.8 + 12)}
                    y={-10}
                    width={Math.max(52, edge.label.length * 7.6 + 24)}
                    height={20}
                    rx={6}
                    fill="var(--bg-panel)"
                    stroke={
                      highlighted ? "var(--accent)" : "var(--border-subtle)"
                    }
                    strokeWidth={1}
                  />
                  <text
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize="10"
                    fontWeight="500"
                    fill={highlighted ? "var(--accent)" : "var(--text-muted)"}
                    className="tabular-nums"
                  >
                    {edge.label}
                  </text>
                </g>
              </g>
            );
          })}
        </svg>

        {/* Карточки узлов агентов с плавной анимацией появления */}
        <AnimatePresence>
          {graph.nodes.map((node) => {
            const isSelected = node.id === selectedNodeId;
            const statusColor =
              node.status === "working" || node.status === "alive"
                ? "var(--status-ok)"
                : node.status === "killed"
                  ? "var(--status-danger)"
                  : "var(--text-muted)";

            return (
              <motion.div
                key={node.id}
                data-graph-node="true"
                initial={{ opacity: 0, scale: 0.65, y: 18 }}
                animate={{
                  opacity: 1,
                  scale: 1,
                  y: 0,
                  transition: {
                    type: "spring",
                    stiffness: 280,
                    damping: 22,
                  },
                }}
                exit={{ opacity: 0, scale: 0.7, y: -10 }}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  onSelectNode(node.id);
                  setDraggingNode({
                    id: node.id,
                    startX: e.clientX,
                    startY: e.clientY,
                    origX: node.x,
                    origY: node.y,
                  });
                }}
                style={{
                  left: node.x,
                  top: node.y,
                  width: GRAPH_NODE_WIDTH,
                  minHeight: GRAPH_NODE_HEIGHT,
                  backgroundColor: "var(--bg-panel)",
                  borderColor: isSelected
                    ? "var(--accent)"
                    : node.isActiveAtCursor
                      ? "var(--accent)"
                      : "var(--border-subtle)",
                  boxShadow: isSelected
                    ? "0 0 0 1.5px var(--accent), 0 8px 24px -4px rgba(0,0,0,0.25)"
                    : node.isActiveAtCursor
                      ? "0 0 16px -2px var(--accent)"
                      : "0 2px 8px -2px rgba(0,0,0,0.12)",
                }}
                className="absolute rounded-xl border px-3 py-2 cursor-pointer flex flex-col justify-between transition-colors z-10"
              >
                {/* Верхняя строка: статус, имя, модель */}
                <div className="flex items-center justify-between gap-2 min-w-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: statusColor }}
                    />
                    <span
                      className="text-xs font-semibold truncate"
                      style={{ color: "var(--text-primary)" }}
                      title={node.label}
                    >
                      {node.label}
                    </span>
                  </div>
                  <span
                    className="px-1.5 py-0.5 rounded text-[10px] font-medium shrink-0 border tabular-nums"
                    style={{
                      backgroundColor: "var(--bg-elevated)",
                      borderColor: "var(--border-subtle)",
                      color: "var(--text-secondary)",
                    }}
                  >
                    {shortModelName(node.model)}
                  </span>
                </div>

                {/* Подсветка цепочки передачи задачи: от кого получен промпт и кому передан */}
                {settings.highlightHandoffChain &&
                  (node.promptSource || node.handoffTarget) && (
                    <div className="flex flex-col gap-0.5 my-1 text-[10px] font-medium border-t pt-1" style={{ borderColor: "var(--border-subtle)" }}>
                      {node.promptSource && (
                        <div
                          className="flex items-center gap-1 text-[10px] truncate"
                          style={{ color: "var(--accent)" }}
                          title={`Получен промпт от @${node.promptSource}`}
                        >
                          <ArrowDownRight
                            className="w-3 h-3 shrink-0"
                            strokeWidth={1.8}
                          />
                          <span className="truncate">
                            от @{node.promptSource}
                          </span>
                        </div>
                      )}
                      {node.handoffTarget && (
                        <div
                          className="flex items-center gap-1 text-[10px] truncate"
                          style={{ color: "var(--status-ok)" }}
                          title={`Передал задачу к @${node.handoffTarget}`}
                        >
                          <ArrowUpRight
                            className="w-3 h-3 shrink-0"
                            strokeWidth={1.8}
                          />
                          <span className="truncate">
                            → к @{node.handoffTarget}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                {/* Нижняя строка: подзаголовок и счётчик сообщений */}
                <div className="flex items-center justify-between gap-2 text-[11px] min-w-0 pt-1">
                  <span
                    className="truncate"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {node.subtitle} · {formatStatusRu(node.status)}
                  </span>
                  <span
                    className="shrink-0 tabular-nums font-medium"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {node.sentCount}↑ {node.receivedCount}↓
                  </span>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Пустое состояние */}
      {graph.nodes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div
            className="px-5 py-4 rounded-xl border text-center max-w-sm backdrop-blur-md shadow-lg"
            style={{
              backgroundColor: "var(--bg-panel)",
              borderColor: "var(--border-subtle)",
            }}
          >
            <div className="w-8 h-8 rounded-lg mx-auto mb-2 flex items-center justify-center border" style={{ backgroundColor: "var(--accent-soft)", borderColor: "var(--border-strong)", color: "var(--accent)" }}>
              <Sparkles className="w-4 h-4" strokeWidth={1.6} />
            </div>
            <div
              className="text-sm font-semibold"
              style={{ color: "var(--text-primary)" }}
            >
              {settings.onlyActiveWork
                ? "Активных работ сейчас нет"
                : "Выберите рой или сессию слева"}
            </div>
            <div
              className="mt-1 text-xs"
              style={{ color: "var(--text-muted)" }}
            >
              {settings.onlyActiveWork
                ? "Включен фильтр только активных задач. Переключите режим в шапке или запустите агент."
                : "SwarmGraph автоматически построит граф при появлении сообщений и вызовов"}
            </div>
          </div>
        </div>
      )}

      {/* Плавающий док хронологии (Replay) */}
      {board.length > 0 && (
        <div
          className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2.5 px-3.5 py-2 rounded-xl border max-w-[92%] shadow-xl backdrop-blur-md"
          style={{
            backgroundColor: "var(--bg-panel)",
            borderColor: "var(--border-strong)",
          }}
        >
          <button
            type="button"
            onClick={onTogglePlay}
            title={isPlaying ? "Пауза" : "Воспроизвести хронологию"}
            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 cursor-pointer shadow-sm"
            style={{
              backgroundColor: "var(--accent)",
              color: "var(--accent-fg)",
            }}
          >
            {isPlaying ? (
              <Pause className="w-4 h-4" strokeWidth={1.8} />
            ) : (
              <Play className="w-4 h-4 ml-0.5" strokeWidth={1.8} />
            )}
          </button>

          <button
            type="button"
            onClick={() => onStepReplay(-1)}
            title="Предыдущий шаг"
            className="w-7 h-7 rounded-md border flex items-center justify-center shrink-0 cursor-pointer"
            style={{
              backgroundColor: "var(--bg-elevated)",
              borderColor: "var(--border-subtle)",
              color: "var(--text-secondary)",
            }}
          >
            <ChevronLeft className="w-3.5 h-3.5" strokeWidth={1.6} />
          </button>

          <input
            type="range"
            min={minSeq}
            max={maxSeq}
            value={effectiveSeq}
            onChange={(e) => onSetReplaySeq(Number(e.target.value))}
            aria-label="Позиция хронологии"
            className="w-40 sm:w-64 accent-[var(--accent)] cursor-pointer"
          />

          <button
            type="button"
            onClick={() => onStepReplay(1)}
            title="Следующий шаг"
            className="w-7 h-7 rounded-md border flex items-center justify-center shrink-0 cursor-pointer"
            style={{
              backgroundColor: "var(--bg-elevated)",
              borderColor: "var(--border-subtle)",
              color: "var(--text-secondary)",
            }}
          >
            <ChevronRight className="w-3.5 h-3.5" strokeWidth={1.6} />
          </button>

          <span
            className="text-xs font-semibold tabular-nums shrink-0"
            style={{ color: "var(--text-secondary)" }}
          >
            {effectiveSeq} / {maxSeq}
          </span>

          <select
            value={playbackSpeed}
            onChange={(e) => onChangeSpeed(Number(e.target.value))}
            aria-label="Скорость воспроизведения"
            className="h-7 px-2 rounded-md border text-[11px] font-medium cursor-pointer outline-none tabular-nums"
            style={{
              backgroundColor: "var(--bg-elevated)",
              borderColor: "var(--border-subtle)",
              color: "var(--text-secondary)",
            }}
          >
            <option value={0.5}>0.5x</option>
            <option value={1}>1x</option>
            <option value={2}>2x</option>
            <option value={4}>4x</option>
          </select>

          <button
            type="button"
            onClick={() => onSetReplaySeq(null)}
            className="h-7 px-2.5 rounded-md border text-[11px] font-semibold flex items-center gap-1.5 shrink-0 cursor-pointer"
            style={{
              backgroundColor: isLiveMode
                ? "rgba(16, 185, 129, 0.16)"
                : "var(--bg-elevated)",
              borderColor: isLiveMode
                ? "var(--status-ok)"
                : "var(--border-subtle)",
              color: isLiveMode ? "var(--status-ok)" : "var(--text-secondary)",
            }}
          >
            <Radio className="w-3 h-3 shrink-0" strokeWidth={1.8} />
            <span>LIVE</span>
          </button>
        </div>
      )}
    </section>
  );
}
