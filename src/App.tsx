import { useCallback, useEffect, useMemo, useState } from "react";
import { CommandPalette } from "./components/CommandPalette";
import { ConnectAgentModal } from "./components/ConnectAgentModal";
import { ExportModal } from "./components/ExportModal";
import { GraphCanvas } from "./components/GraphCanvas";
import { InspectorPanel } from "./components/InspectorPanel";
import { SessionSidebar } from "./components/SessionSidebar";
import { SettingsModal } from "./components/SettingsModal";
import { SwarmControlModal } from "./components/SwarmControlModal";
import { TopBar } from "./components/TopBar";
import { isMostlyEnglish } from "./lib/formatters";
import { buildSwarmGraph, getReplayFeedSlice } from "./lib/graphBuilder";
import {
  addSwarmWorker,
  getSessionDetail,
  killSwarmWorker,
  listSessions,
  pickBrainDirectory,
  postSwarmMessage,
  setBrainDir,
  subscribeBrainChanges,
  translateTextsToRu,
} from "./lib/tauriBridge";
import type {
  SessionDetail,
  SessionSummary,
  SettingsState,
  ThemeMode,
} from "./types";

const DEFAULT_SETTINGS: SettingsState = {
  theme: "system",
  preset: "graphite",
  fontFamily: "geist",
  onlyActiveWork: false,
  appearOnStartOnly: true,
  highlightHandoffChain: true,
  compactLayout: false,
  gridStyle: "dots",
  nodeDensity: "standard",
  animationSpeed: "smooth",
  autoTranslate: true,
  enabledPlatforms: ["antigravity", "claude_code", "codex", "custom"],
  customSources: [],
};

function loadSavedSettings(): SettingsState {
  try {
    const raw = localStorage.getItem("swarmgraph-settings");
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        ...DEFAULT_SETTINGS,
        ...parsed,
        enabledPlatforms:
          Array.isArray(parsed.enabledPlatforms) &&
          parsed.enabledPlatforms.length > 0
            ? parsed.enabledPlatforms
            : DEFAULT_SETTINGS.enabledPlatforms,
        customSources: Array.isArray(parsed.customSources)
          ? parsed.customSources
          : DEFAULT_SETTINGS.customSources,
      };
    }
  } catch {
    /* fallback */
  }
  return DEFAULT_SETTINGS;
}

function getSystemDark(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  );
}

export function App() {
  const [settings, setSettings] = useState<SettingsState>(loadSavedSettings);
  const [systemDark, setSystemDark] = useState<boolean>(getSystemDark);

  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [detail, setDetail] = useState<SessionDetail | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [activeChannel, setActiveChannel] = useState<string>("*");
  const [customPositions, setCustomPositions] = useState<
    Record<string, { x: number; y: number }>
  >({});

  // Replay
  const [replaySeq, setReplaySeq] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);

  // Интерактивный ресайз боковых панелей с сохранением в localStorage
  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    try {
      const saved = localStorage.getItem("swarmgraph-sidebar-width");
      if (saved) {
        const val = parseInt(saved, 10);
        if (val >= 180 && val <= 500) return val;
      }
    } catch {
      /* ignore */
    }
    return 270;
  });

  const [inspectorWidth, setInspectorWidth] = useState<number>(() => {
    try {
      const saved = localStorage.getItem("swarmgraph-inspector-width");
      if (saved) {
        const val = parseInt(saved, 10);
        if (val >= 260 && val <= 650) return val;
      }
    } catch {
      /* ignore */
    }
    return 360;
  });

  const [isResizingSidebar, setIsResizingSidebar] = useState(false);
  const [isResizingInspector, setIsResizingInspector] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem("swarmgraph-sidebar-width", String(sidebarWidth));
    } catch {
      /* ignore */
    }
  }, [sidebarWidth]);

  useEffect(() => {
    try {
      localStorage.setItem("swarmgraph-inspector-width", String(inspectorWidth));
    } catch {
      /* ignore */
    }
  }, [inspectorWidth]);

  const handleStartResizeSidebar = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsResizingSidebar(true);
      const startX = e.clientX;
      const startWidth = sidebarWidth;

      const onMouseMove = (moveEvent: MouseEvent) => {
        const delta = moveEvent.clientX - startX;
        const newWidth = Math.max(180, Math.min(500, startWidth + delta));
        setSidebarWidth(newWidth);
      };

      const onMouseUp = () => {
        setIsResizingSidebar(false);
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", onMouseUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };

      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
    },
    [sidebarWidth],
  );

  const handleStartResizeInspector = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsResizingInspector(true);
      const startX = e.clientX;
      const startWidth = inspectorWidth;

      const onMouseMove = (moveEvent: MouseEvent) => {
        const delta = startX - moveEvent.clientX;
        const newWidth = Math.max(260, Math.min(650, startWidth + delta));
        setInspectorWidth(newWidth);
      };

      const onMouseUp = () => {
        setIsResizingInspector(false);
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", onMouseUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };

      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
    },
    [inspectorWidth],
  );

  // Переводчик EN -> RU
  const [isTranslating, setIsTranslating] = useState(false);
  const [translatedMap, setTranslatedMap] = useState<Record<string, string>>({});

  // Модальные окна
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [swarmModalOpen, setSwarmModalOpen] = useState(false);
  const [connectModalOpen, setConnectModalOpen] = useState(false);

  const effectiveDark =
    settings.theme === "dark"
      ? true
      : settings.theme === "light"
        ? false
        : systemDark;

  // Сохранение настроек в localStorage
  useEffect(() => {
    try {
      localStorage.setItem("swarmgraph-settings", JSON.stringify(settings));
    } catch {
      /* ignore */
    }
  }, [settings]);

  // Отслеживание системной темы
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const listener = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener("change", listener);
    return () => mq.removeEventListener("change", listener);
  }, []);

  // Синхронизация <meta name="color-scheme"> и пресета оформления
  useEffect(() => {
    const meta = document.querySelector('meta[name="color-scheme"]');
    if (meta) {
      meta.setAttribute(
        "content",
        settings.theme === "system" ? "light dark" : settings.theme,
      );
    }
  }, [settings.theme]);

  useEffect(() => {
    document.documentElement.setAttribute("data-preset", settings.preset);
  }, [settings.preset]);

  // Синхронизация шрифта интерфейса
  useEffect(() => {
    const font = settings.fontFamily ?? "geist";
    document.documentElement.setAttribute("data-font", font);
    try {
      localStorage.setItem("swarmgraph-font-family", font);
    } catch {
      /* ignore */
    }
  }, [settings.fontFamily]);

  // Снятие стандартных рамок ОС после полной загрузки WebView2 (без крашей 0x80070578)
  useEffect(() => {
    try {
      import("@tauri-apps/api/webviewWindow")
        .then(({ getCurrentWebviewWindow }) => {
          const win = getCurrentWebviewWindow();
          win.setDecorations(false).catch(() => {});
        })
        .catch(() => {});
    } catch {
      /* ignore outside Tauri */
    }
  }, []);

  // Горячая клавиша Ctrl+K / Cmd+K и Ctrl+,
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((prev) => !prev);
      } else if ((e.ctrlKey || e.metaKey) && e.key === ",") {
        e.preventDefault();
        setSettingsOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Загрузка списка сессий
  const refreshSessions = useCallback(async () => {
    try {
      const list = await listSessions();
      setSessions(list);
      setSelectedSessionId((current) => {
        if (current && list.some((s) => s.id === current)) return current;
        return list[0]?.id ?? null;
      });
    } catch (e) {
      console.error("Ошибка при получении списка сессий:", e);
    }
  }, []);

  useEffect(() => {
    refreshSessions();
  }, [refreshSessions]);

  // Подписка на файловые события brain (watcher)
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    subscribeBrainChanges((event) => {
      if (event.session_id) {
        if (event.session_id === selectedSessionId) {
          getSessionDetail(event.session_id).then((d) => setDetail(d));
        }
      }
      refreshSessions();
    }).then((fn) => {
      unlisten = fn;
    });
    return () => {
      unlisten?.();
    };
  }, [refreshSessions, selectedSessionId]);

  // Загрузка деталей выбранной сессии
  useEffect(() => {
    if (!selectedSessionId) {
      setDetail(null);
      setSelectedNodeId(null);
      return;
    }
    let cancelled = false;
    getSessionDetail(selectedSessionId)
      .then((d) => {
        if (cancelled) return;
        setDetail(d);
        setSelectedNodeId(null);
        setReplaySeq(null);
        setIsPlaying(false);
      })
      .catch((e) => {
        if (!cancelled) console.error("Ошибка деталей сессии:", e);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedSessionId]);

  // Фоновый автоперевод текстов на русский язык (сообщения доски, шаги транскрипта, промпты)
  useEffect(() => {
    if (!settings.autoTranslate || !detail) return;
    const missing: string[] = [];

    const addIfMissing = (str: string | undefined | null, minLen = 4) => {
      const trimmed = str?.trim();
      if (
        trimmed &&
        trimmed.length >= minLen &&
        !translatedMap[trimmed] &&
        !missing.includes(trimmed) &&
        isMostlyEnglish(trimmed)
      ) {
        missing.push(trimmed);
      }
    };

    // 1. Сообщения доски роя
    for (const msg of detail.board) {
      addIfMissing(msg.text, 4);
    }

    // 2. Шаги транскриптов, действия инструментов и промпты субагентов
    for (const steps of Object.values(detail.transcripts)) {
      for (const step of steps) {
        addIfMissing(step.content_preview, 6);
        if (step.actions) {
          for (const act of step.actions) {
            addIfMissing(act.detail, 4);
          }
        }
      }
    }

    if (missing.length === 0) return;

    let cancelled = false;
    setIsTranslating(true);
    translateTextsToRu(missing.slice(0, 50))
      .then((map) => {
        if (!cancelled && Object.keys(map).length > 0) {
          setTranslatedMap((prev) => {
            const next = { ...prev, ...map };
            // Сохраняем также по trimmed ключам
            for (const [k, v] of Object.entries(map)) {
              next[k.trim()] = v;
            }
            return next;
          });
        }
      })
      .catch((e) => console.warn("Фоновый перевод пропущен:", e))
      .finally(() => {
        if (!cancelled) setIsTranslating(false);
      });

    return () => {
      cancelled = true;
    };
  }, [detail, settings.autoTranslate, translatedMap]);

  // Построение графа с учетом фильтров и настроек
  const graph = useMemo(() => {
    return buildSwarmGraph(detail, {
      replaySeq,
      activeChannel,
      customPositions,
      settings,
    });
  }, [detail, replaySeq, activeChannel, customPositions, settings]);

  const activeSession = useMemo(() => {
    return sessions.find((s) => s.id === selectedSessionId) ?? null;
  }, [sessions, selectedSessionId]);

  // Replay таймер
  useEffect(() => {
    if (!isPlaying || !detail || detail.board.length === 0) return;
    const seqs = detail.board.map((m) => m.seq);
    const intervalMs = Math.max(120, Math.round(900 / playbackSpeed));

    const t = setInterval(() => {
      setReplaySeq((current) => {
        const last = seqs[seqs.length - 1];
        if (current === null || current >= last) {
          setIsPlaying(false);
          return last;
        }
        const next = seqs.find((s) => s > current);
        if (next === undefined) {
          setIsPlaying(false);
          return last;
        }
        return next;
      });
    }, intervalMs);

    return () => clearInterval(t);
  }, [isPlaying, detail, playbackSpeed]);

  const filteredBoard = useMemo(() => {
    return getReplayFeedSlice(detail?.board ?? [], replaySeq, activeChannel);
  }, [detail, replaySeq, activeChannel]);

  const cycleTheme = () => {
    setSettings((s) => {
      const nextTheme: ThemeMode =
        s.theme === "system" ? "dark" : s.theme === "dark" ? "light" : "system";
      return { ...s, theme: nextTheme };
    });
  };

  const handleStepReplay = (delta: -1 | 1) => {
    if (!detail || detail.board.length === 0) return;
    setIsPlaying(false);
    const seqs = detail.board.map((m) => m.seq);
    setReplaySeq((current) => {
      const curr = current ?? seqs[seqs.length - 1];
      if (delta > 0) {
        return seqs.find((s) => s > curr) ?? curr;
      }
      const prevs = seqs.filter((s) => s < curr);
      return prevs.length > 0 ? prevs[prevs.length - 1] : seqs[0];
    });
  };

  const handleToggleCompactLayout = useCallback(() => {
    setSettings((s) => ({ ...s, compactLayout: !s.compactLayout }));
  }, []);

  const handleTogglePlay = () => {
    if (!detail || detail.board.length === 0) return;
    const seqs = detail.board.map((m) => m.seq);
    if (!isPlaying && (replaySeq === null || replaySeq >= seqs[seqs.length - 1])) {
      setReplaySeq(seqs[0]);
    }
    setIsPlaying((p) => !p);
  };

  const handleChangeBrainDir = async () => {
    const dir = await pickBrainDirectory();
    if (!dir) return;
    await setBrainDir(dir);
    await refreshSessions();
  };

  const handleAddWorker = async (payload: {
    name: string;
    role: "worker" | "verifier" | "utility";
    model: string;
    brief: string;
  }) => {
    if (!selectedSessionId) return;
    await addSwarmWorker(selectedSessionId, payload);
    const updated = await getSessionDetail(selectedSessionId);
    setDetail(updated);
    await refreshSessions();
  };

  const handlePostMessage = async (text: string) => {
    if (!selectedSessionId) return;
    await postSwarmMessage(selectedSessionId, text);
    const updated = await getSessionDetail(selectedSessionId);
    setDetail(updated);
  };

  const handleKillWorker = async (name: string) => {
    if (!selectedSessionId) return;
    await killSwarmWorker(selectedSessionId, name);
    const updated = await getSessionDetail(selectedSessionId);
    setDetail(updated);
    await refreshSessions();
  };

  return (
    <div
      className="h-screen w-screen flex flex-col overflow-hidden"
      style={{ backgroundColor: "var(--bg-app)" }}
    >
      <TopBar
        activeSession={activeSession}
        settings={settings}
        effectiveDark={effectiveDark}
        autoTranslate={settings.autoTranslate}
        isTranslating={isTranslating}
        onToggleActiveOnly={() =>
          setSettings((s) => ({ ...s, onlyActiveWork: !s.onlyActiveWork }))
        }
        onToggleCompactLayout={handleToggleCompactLayout}
        onToggleTranslate={() =>
          setSettings((s) => ({ ...s, autoTranslate: !s.autoTranslate }))
        }
        onCycleTheme={cycleTheme}
        onOpenCommandPalette={() => setPaletteOpen(true)}
        onOpenConnectAgent={() => setConnectModalOpen(true)}
        onOpenExport={() => setExportOpen(true)}
        onOpenSettings={() => setSettingsOpen(true)}
        onRefresh={refreshSessions}
      />

      <main className="flex-1 min-h-0 flex overflow-hidden">
        <SessionSidebar
          width={sidebarWidth}
          sessions={sessions}
          selectedSessionId={selectedSessionId}
          detail={detail}
          graphNodes={graph.nodes}
          selectedNodeId={selectedNodeId}
          activeChannel={activeChannel}
          onlyActiveSessions={settings.onlyActiveWork}
          enabledPlatforms={settings.enabledPlatforms}
          onToggleOnlyActiveSessions={() =>
            setSettings((s) => ({ ...s, onlyActiveWork: !s.onlyActiveWork }))
          }
          onOpenCreateSwarm={() => setSwarmModalOpen(true)}
          onSelectSession={setSelectedSessionId}
          onSelectNode={setSelectedNodeId}
          onSelectChannel={setActiveChannel}
        />

        {/* Разделитель-ресайзер левой панели */}
        <div
          role="separator"
          aria-orientation="vertical"
          title="Перетащите для изменения ширины списка сессий (двойной клик — сброс к 270px)"
          onMouseDown={handleStartResizeSidebar}
          onDoubleClick={() => setSidebarWidth(270)}
          className="w-1 hover:w-1.5 shrink-0 cursor-col-resize relative group transition-all select-none z-10"
          style={{
            backgroundColor: isResizingSidebar
              ? "var(--accent)"
              : "var(--border-subtle)",
          }}
        >
          <div className="absolute inset-y-0 -left-1 -right-1 group-hover:bg-[var(--accent)]/15 transition-colors" />
        </div>

        <GraphCanvas
          graph={graph}
          preset={settings.preset}
          settings={settings}
          selectedNodeId={selectedNodeId}
          onSelectNode={setSelectedNodeId}
          onUpdateNodePosition={(id, x, y) =>
            setCustomPositions((prev) => ({ ...prev, [id]: { x, y } }))
          }
          onResetLayout={() => setCustomPositions({})}
          onToggleCompactLayout={handleToggleCompactLayout}
          board={detail?.board ?? []}
          replaySeq={replaySeq}
          isPlaying={isPlaying}
          playbackSpeed={playbackSpeed}
          onSetReplaySeq={(seq) => {
            setIsPlaying(false);
            setReplaySeq(seq);
          }}
          onTogglePlay={handleTogglePlay}
          onStepReplay={handleStepReplay}
          onChangeSpeed={setPlaybackSpeed}
        />

        {/* Разделитель-ресайзер правой панели */}
        <div
          role="separator"
          aria-orientation="vertical"
          title="Перетащите для изменения ширины инспектора (двойной клик — сброс к 360px)"
          onMouseDown={handleStartResizeInspector}
          onDoubleClick={() => setInspectorWidth(360)}
          className="w-1 hover:w-1.5 shrink-0 cursor-col-resize relative group transition-all select-none z-10"
          style={{
            backgroundColor: isResizingInspector
              ? "var(--accent)"
              : "var(--border-subtle)",
          }}
        >
          <div className="absolute inset-y-0 -left-1 -right-1 group-hover:bg-[var(--accent)]/15 transition-colors" />
        </div>

        <InspectorPanel
          width={inspectorWidth}
          detail={detail}
          graphNodes={graph.nodes}
          selectedNodeId={selectedNodeId}
          filteredBoard={filteredBoard}
          replaySeq={replaySeq}
          autoTranslate={settings.autoTranslate}
          translatedMap={translatedMap}
          onSelectNode={setSelectedNodeId}
          onJumpToSeq={(seq) => {
            setIsPlaying(false);
            setReplaySeq(seq);
          }}
        />
      </main>

      <CommandPalette
        open={paletteOpen}
        sessions={sessions}
        graphNodes={graph.nodes}
        onClose={() => setPaletteOpen(false)}
        onSelectSession={setSelectedSessionId}
        onSelectNode={setSelectedNodeId}
        onSelectPreset={(p) => setSettings((s) => ({ ...s, preset: p }))}
        onToggleTheme={cycleTheme}
        onToggleTranslate={() =>
          setSettings((s) => ({ ...s, autoTranslate: !s.autoTranslate }))
        }
        onOpenExport={() => setExportOpen(true)}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      <ExportModal
        open={exportOpen}
        detail={detail}
        activeChannel={activeChannel}
        customPositions={customPositions}
        preset={settings.preset}
        isDark={effectiveDark}
        autoTranslate={settings.autoTranslate}
        translatedMap={translatedMap}
        onClose={() => setExportOpen(false)}
      />

      <SettingsModal
        open={settingsOpen}
        settings={settings}
        onUpdateSettings={setSettings}
        onChangeBrainDir={handleChangeBrainDir}
        onClose={() => setSettingsOpen(false)}
      />

      <SwarmControlModal
        open={swarmModalOpen}
        activeSession={detail}
        onClose={() => setSwarmModalOpen(false)}
        onAddWorker={handleAddWorker}
        onPostMessage={handlePostMessage}
        onKillWorker={handleKillWorker}
      />

      <ConnectAgentModal
        open={connectModalOpen}
        sessionRootPath={detail?.summary.root_path}
        onClose={() => setConnectModalOpen(false)}
      />
    </div>
  );
}

export default App;
