import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { DEFAULT_PORT } from "@code-mobile/core";

const app = new Hono();

app.use("*", logger());
app.use("*", cors());

app.get("/health", (c) =>
  c.json({ status: "ok", version: "0.0.1", uptime: process.uptime() }),
);

app.get("/", (c) => c.json({ message: "CODE Mobile Daemon" }));

console.log(`CODE Mobile Daemon starting on port ${DEFAULT_PORT}...`);

export default {
  port: DEFAULT_PORT,
  fetch: app.fetch,
};
