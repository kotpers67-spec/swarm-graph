export type ThemeMode = "system" | "dark" | "light";
export type StylePreset = "graphite" | "obsidian" | "blueprint" | "midnight";
export type GridStyle = "dots" | "blueprint" | "minimal";
export type NodeDensity = "compact" | "standard" | "detailed";
export type AnimationSpeed = "fast" | "smooth" | "cinematic";
export type FontFamilyPreset =
  | "geist"
  | "segoe"
  | "jetbrains"
  | "outfit"
  | "ibm-plex"
  | "fira-code";

export type AgentPlatform = "antigravity" | "claude_code" | "codex" | "custom";

export interface CustomPlatformSource {
  id: string;
  name: string;
  path: string;
  enabled: boolean;
}

export interface SettingsState {
  theme: ThemeMode;
  preset: StylePreset;
  fontFamily: FontFamilyPreset;
  onlyActiveWork: boolean;
  appearOnStartOnly: boolean;
  highlightHandoffChain: boolean;
  compactLayout: boolean;
  gridStyle: GridStyle;
  nodeDensity: NodeDensity;
  animationSpeed: AnimationSpeed;
  autoTranslate: boolean;
  enabledPlatforms: AgentPlatform[];
  customSources: CustomPlatformSource[];
}

export interface SessionSummary {
  id: string;
  title: string;
  has_swarm: boolean;
  is_live: boolean;
  created_at: string;
  updated_at_ms: number;
  member_count: number;
  subagent_count: number;
  board_count: number;
  channels: string[];
  root_path: string;
  platform?: AgentPlatform;
  source?: "antigravity" | "claude" | "codex";
}

export interface CreateSwarmWorkerPayload {
  name: string;
  role: "worker" | "verifier" | "utility" | "coordinator";
  model: string;
  brief: string;
  workspaceMode?: "inherit" | "share" | "branch";
}

export interface SwarmMeta {
  version: number;
  backend: string;
  swarm_id: string;
  created_at: string;
}

export interface SwarmMember {
  name: string;
  conversation_id: string;
  role: string;
  phase: string;
  desired_state: string;
  desired_model: string;
  applied_model: string;
  model: string;
  workspace_mode: string;
  wake_mode: string;
  wait_since: number;
  last_read_seq: number;
  killed: boolean;
  channels: string[];
}

export interface BoardMessage {
  seq: number;
  agent: string;
  text: string;
  time: string;
  kind: string;
  request_id: string;
  channel: string;
  mentions: string[];
  seq_refs: number[];
}

export interface SubagentNode {
  conversation_id: string;
  type_name: string;
  role: string;
  state: string;
  spawn_step_index: number;
  parent_conversation_id: string;
}

export interface ToolAction {
  kind:
    | "create"
    | "edit"
    | "read"
    | "run"
    | "search"
    | "think"
    | "user"
    | "generic"
    | "other";
  verb_en: string;
  verb_ru: string;
  file_name?: string;
  file_ext?: string;
  diff_stats?: string;
  detail: string;
}

export interface TranscriptStep {
  step_index: number;
  source: string;
  step_type: string;
  status: string;
  created_at: string;
  content_preview: string;
  tool_names: string[];
  input_tokens: number;
  output_tokens: number;
  actions?: ToolAction[];
}

export interface SessionDetail {
  summary: SessionSummary;
  swarm_meta: SwarmMeta | null;
  members: SwarmMember[];
  board: BoardMessage[];
  subagents: SubagentNode[];
  transcripts: Record<string, TranscriptStep[]>;
  platform?: AgentPlatform;
}

export type GraphNodeKind = "coordinator" | "worker" | "verifier" | "utility" | "subagent";

export interface GraphNode {
  id: string;
  label: string;
  subtitle: string;
  kind: GraphNodeKind;
  conversationId: string;
  model: string;
  status: "working" | "waiting" | "killed" | "alive";
  sentCount: number;
  receivedCount: number;
  isActiveAtCursor: boolean;
  firstActiveSeq: number | null;
  promptSource: string | null;
  handoffTarget: string | null;
  hasStarted: boolean;
  platform?: AgentPlatform;
  x: number;
  y: number;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  kind: "mention" | "spawn";
  handoffRole?: "prompt" | "handoff" | "spawn" | "mention";
  count: number;
  seqs: number[];
  isActiveAtCursor: boolean;
  label: string;
}

export interface ComputedGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}
