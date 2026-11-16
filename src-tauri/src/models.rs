use serde::{Deserialize, Serialize};
use std::collections::HashMap;

fn default_platform() -> String {
    "antigravity".to_string()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionSummary {
    pub id: String,
    pub title: String,
    pub has_swarm: bool,
    pub is_live: bool,
    pub created_at: String,
    pub updated_at_ms: u64,
    pub member_count: usize,
    pub subagent_count: usize,
    pub board_count: usize,
    pub channels: Vec<String>,
    pub root_path: String,
    #[serde(default)]
    pub source: Option<String>,
    #[serde(default = "default_platform")]
    pub platform: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SwarmMeta {
    pub version: u32,
    pub backend: String,
    pub swarm_id: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SwarmMember {
    pub name: String,
    pub conversation_id: String,
    pub role: String,
    pub phase: String,
    pub desired_state: String,
    pub desired_model: String,
    pub applied_model: String,
    pub model: String,
    pub workspace_mode: String,
    pub wake_mode: String,
    pub wait_since: u64,
    pub last_read_seq: u64,
    pub killed: bool,
    pub channels: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BoardMessage {
    pub seq: u64,
    pub agent: String,
    pub text: String,
    pub time: String,
    pub kind: String,
    pub request_id: String,
    pub channel: String,
    pub mentions: Vec<String>,
    pub seq_refs: Vec<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SubagentNode {
    pub conversation_id: String,
    pub type_name: String,
    pub role: String,
    pub state: String,
    pub spawn_step_index: u64,
    pub parent_conversation_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolAction {
    pub kind: String,
    pub verb_en: String,
    pub verb_ru: String,
    #[serde(default)]
    pub file_name: Option<String>,
    #[serde(default)]
    pub file_ext: Option<String>,
    #[serde(default)]
    pub diff_stats: Option<String>,
    pub detail: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TranscriptStep {
    pub step_index: u64,
    pub source: String,
    pub step_type: String,
    pub status: String,
    pub created_at: String,
    pub content_preview: String,
    pub tool_names: Vec<String>,
    pub input_tokens: u64,
    pub output_tokens: u64,
    #[serde(default)]
    pub actions: Vec<ToolAction>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionDetail {
    pub summary: SessionSummary,
    pub swarm_meta: Option<SwarmMeta>,
    pub members: Vec<SwarmMember>,
    pub board: Vec<BoardMessage>,
    pub subagents: Vec<SubagentNode>,
    pub transcripts: HashMap<String, Vec<TranscriptStep>>,
    #[serde(default = "default_platform")]
    pub platform: String,
}
