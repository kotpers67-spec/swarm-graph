#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const home = process.env.USERPROFILE || process.env.HOME || "C:\\Users\\kotpe";
const brainDir = process.env.ANTIGRAVITY_BRAIN_DIR || path.join(home, ".gemini", "antigravity", "brain");

function findLatestSwarmSession() {
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

const cmd = process.argv[2] || "help";
const arg = process.argv.slice(3).join(" ");
const session = findLatestSwarmSession();

if (!session) {
  console.error("Ошибка: Активный рой SwarmGraph не найден в", brainDir);
  process.exit(1);
}

if (cmd === "board" || cmd === "read") {
  const lines = fs.readFileSync(session.boardPath, "utf-8").split("\n").filter(Boolean);
  const msgs = lines.map((l) => JSON.parse(l)).slice(-15);
  console.log(`=== ДОСКА РОЯ [${session.sessionId}] ===`);
  for (const m of msgs) {
    console.log(`[#${m.seq}] @${m.agent} (${m.time}): ${m.text}`);
  }
} else if (cmd === "send" || cmd === "post") {
  if (!arg) {
    console.error("Использование: swarm-cli send \"@coordinator текст сообщения\"");
    process.exit(1);
  }
  const lines = fs.readFileSync(session.boardPath, "utf-8").split("\n").filter(Boolean);
  const nextSeq = lines.length + 1;
  const mentions = [];
  const re = /@([a-zA-Z0-9_#-]+)/g;
  let m;
  while ((m = re.exec(arg)) !== null) {
    mentions.push(m[1]);
  }
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const timeStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  const sender = process.env.SWARM_AGENT_NAME || "cli-agent";

  const msg = {
    seq: nextSeq,
    agent: sender,
    text: arg,
    time: timeStr,
    kind: "post",
    request_id: `cli-${Date.now()}`,
    channel: "main",
    mentions,
    seq_refs: [],
  };
  fs.appendFileSync(session.boardPath, JSON.stringify(msg) + "\n", "utf-8");
  console.log(`✓ Сообщение #${nextSeq} опубликовано в рой от @${sender}`);
} else if (cmd === "status") {
  const membersPath = path.join(session.swarmDir, "members.json");
  if (fs.existsSync(membersPath)) {
    console.log(fs.readFileSync(membersPath, "utf-8"));
  } else {
    console.log("Участники роя не найдены");
  }
} else {
  console.log("SwarmGraph CLI Bridge:");
  console.log("  swarm-cli board           - Прочитать последние сообщения доски");
  console.log("  swarm-cli send \"<текст>\"   - Опубликовать сообщение в рой");
  console.log("  swarm-cli status          - Список участников роя");
}
