import { mkdirSync } from "fs";
import { websocket } from "hono/bun";
import { loadConfig } from "./config.js";
import { AppDatabase } from "./db/index.js";
import { createApp } from "./server.js";

// ── Load configuration ───────────────────────────────────────
const config = loadConfig();

// ── Ensure data directory exists ─────────────────────────────
mkdirSync(config.dataDir, { recursive: true });

// ── Initialize database ──────────────────────────────────────
console.log(`[daemon] Initializing database at ${config.dataDir}/codemobile.db`);
const database = new AppDatabase(config.dataDir);
database.runMigrations();

// ── Create Hono app ──────────────────────────────────────────
const { app, cleanup } = createApp(config, database);

// ── Start HTTP + WebSocket server ────────────────────────────
const server = Bun.serve({
  port: config.port,
  hostname: config.host,
  fetch: app.fetch,
  websocket,
});

console.log(`
  ┌─────────────────────────────────────────────┐
  │  CODE Mobile Daemon v${config.version}                │
  │                                             │
  │  http://${server.hostname}:${server.port}                   │
  │  Data:  ${config.dataDir}  │
  │  Env:   ${config.nodeEnv}                        │
  └─────────────────────────────────────────────┘
`);

// ── Graceful shutdown ────────────────────────────────────────
async function shutdown(signal: string) {
  console.log(`\n[daemon] Received ${signal}, shutting down...`);

  // Clean up session streamers and keepalive timers
  cleanup();

  // Stop accepting new connections
  server.stop();

  // Close the database
  database.close();

  console.log("[daemon] Shutdown complete.");
  process.exit(0);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("unhandledRejection", (reason) => {
  console.error("[daemon] Unhandled rejection:", reason);
});
