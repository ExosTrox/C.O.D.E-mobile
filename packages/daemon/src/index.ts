import { mkdirSync } from "fs";
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
const app = createApp(config, database);

// ── Start HTTP server ────────────────────────────────────────
const server = Bun.serve({
  port: config.port,
  hostname: config.host,
  fetch: app.fetch,
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

  // Stop accepting new connections
  server.stop();

  // Close the database
  database.close();

  console.log("[daemon] Shutdown complete.");
  process.exit(0);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
