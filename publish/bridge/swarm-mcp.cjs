#!/usr/bin/env node
/**
 * SwarmGraph Model Context Protocol (MCP) Server
 * Позволяет внешним агентам (Claude Code, OpenAI Codex, Cursor) подключаться к общему рою SwarmGraph.
 */

const fs = require("fs");
const path = require("path");
const readline = require("readline");

// По умолчанию берем последний активный рой в ~/.gemini/antigravity/brain
function getDefaultBrainDir() {
  const home = process.env.USERPROFILE || process.env.HOME || "C:\\Users\\kotpe";
  return path.join(home, ".gemini", "antigravity", "brain");
}

function findLatestSwarmSession(brainDir) {
  if (!fs.existsSync(brainDir)) return null;
  const entries = fs.readdirSync(brainDir, { withFileTypes: true });
  let latest = null;
  let latestMs = 0;

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const swarmDir = path.join(brainDir, entry.name, ".system_generated", "swarm");
    const boardPath = path.join(swarmDir, "board.jsonl");
    if (fs.existsSync(boardPath)) {
      const stat = fs.statSync(boardPath);
      if (stat.mtimeMs > latestMs) {
        latestMs = stat.mtimeMs;
        latest = { sessionId: entry.name, swarmDir, boardPath };
      }
    }
  }
  return latest;
}

function readBoard(boardPath, limit = 15) {
  if (!fs.existsSync(boardPath)) return [];
  const lines = fs.readFileSync(boardPath, "utf-8").split("\n").filter(Boolean);
  const msgs = [];
  for (const line of lines) {
    try {
      msgs.push(JSON.parse(line));
    } catch {
      /* ignore */
    }
  }
  return msgs.slice(-limit);
}

function postMessage(boardPath, text, agent = "external-agent", channel = "main") {
  const msgs = readBoard(boardPath, 10000);
  const nextSeq = msgs.length > 0 ? (msgs[msgs.length - 1].seq || 0) + 1 : 1;
  const mentions = [];
  const re = /@([a-zA-Z0-9_#-]+)/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    mentions.push(m[1]);
  }

  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const timeStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

  const newMsg = {
    seq: nextSeq,
    agent,
    text,
    time: timeStr,
    kind: "post",
    request_id: `ext-${Date.now()}`,
    channel,
    mentions,
    seq_refs: [],
  };

  fs.appendFileSync(boardPath, JSON.stringify(newMsg) + "\n", "utf-8");
  return newMsg;
}

// MCP JSON-RPC Stdio Server
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false,
});

rl.on("line", (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;
  try {
    const req = JSON.parse(trimmed);
    handleRequest(req);
  } catch (err) {
    sendResponse({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } });
  }
});

function sendResponse(resp) {
  process.stdout.write(JSON.stringify(resp) + "\n");
}

function handleRequest(req) {
  const { id, method, params } = req;
  const brainDir = process.env.ANTIGRAVITY_BRAIN_DIR || getDefaultBrainDir();
  const session = findLatestSwarmSession(brainDir);

  if (method === "initialize") {
    sendResponse({
      jsonrpc: "2.0",
      id,
      result: {
        protocolVersion: "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: { name: "swarm-graph-bridge", version: "1.0.0" },
      },
    });
    return;
  }

  if (method === "tools/list") {
    sendResponse({
      jsonrpc: "2.0",
      id,
      result: {
        tools: [
          {
            name: "swarm_read_board",
            description: "Прочитать последние сообщения с общей доски роя SwarmGraph",
            inputSchema: {
              type: "object",
              properties: {
                limit: { type: "number", description: "Количество сообщений (по умолчанию 10)" },
              },
            },
          },
          {
            name: "swarm_post_message",
            description: "Отправить сообщение в рой SwarmGraph с упоминаниями агентов (@coordinator, @verifier, @all)",
            inputSchema: {
              type: "object",
              properties: {
                text: { type: "string", description: "Текст сообщения" },
                agent_name: { type: "string", description: "Имя агента-отправителя (например: claude-code, codex)" },
              },
              required: ["text"],
            },
          },
          {
            name: "swarm_status",
            description: "Получить статус роя и список участников",
            inputSchema: { type: "object", properties: {} },
          },
        ],
      },
    });
    return;
  }

  if (method === "tools/call") {
    const toolName = params?.name;
    const args = params?.arguments || {};

    if (!session) {
      sendResponse({
        jsonrpc: "2.0",
        id,
        result: {
          content: [{ type: "text", text: "Активный рой SwarmGraph не найден в " + brainDir }],
        },
      });
      return;
    }

    if (toolName === "swarm_read_board") {
      const msgs = readBoard(session.boardPath, args.limit || 10);
      const text = msgs
        .map((m) => `[#${m.seq}] @${m.agent} (${m.time}): ${m.text}`)
        .join("\n");
      sendResponse({
        jsonrpc: "2.0",
        id,
        result: { content: [{ type: "text", text: text || "Доска пуста" }] },
      });
      return;
    }

    if (toolName === "swarm_post_message") {
      const sender = args.agent_name || "external-agent";
      const posted = postMessage(session.boardPath, args.text, sender);
      sendResponse({
        jsonrpc: "2.0",
        id,
        result: {
          content: [{ type: "text", text: `✓ Сообщение #${posted.seq} опубликовано в рой от @${sender}` }],
        },
      });
      return;
    }

    if (toolName === "swarm_status") {
      const membersPath = path.join(session.swarmDir, "members.json");
      let membersData = "{}";
      if (fs.existsSync(membersPath)) {
        membersData = fs.readFileSync(membersPath, "utf-8");
      }
      sendResponse({
        jsonrpc: "2.0",
        id,
        result: {
          content: [
            {
              type: "text",
              text: `Рой сессии: ${session.sessionId}\nПуть: ${session.swarmDir}\nУчастники: ${membersData}`,
            },
          ],
        },
      });
      return;
    }

    sendResponse({
      jsonrpc: "2.0",
      id,
      error: { code: -32601, message: `Tool not found: ${toolName}` },
    });
    return;
  }

  // Неизвестный метод
  sendResponse({ jsonrpc: "2.0", id, result: {} });
}
