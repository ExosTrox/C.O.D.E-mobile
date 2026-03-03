import { describe, test, expect, beforeEach, afterEach, beforeAll } from "bun:test";
import { mkdtempSync, rmSync, existsSync, readFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { Hono } from "hono";
import { AppDatabase } from "../../db/index.js";
import { TmuxService, TmuxError } from "../tmux.service.js";
import { SessionStreamer } from "../session.streamer.js";
import { SessionManager } from "../session.manager.js";
import { createSessionRoutes } from "../session.routes.js";

// ── Check if tmux is available ──────────────────────────────

let tmuxAvailable = false;

beforeAll(async () => {
  try {
    const proc = Bun.spawn(["tmux", "-V"], { stdout: "pipe", stderr: "pipe" });
    const exitCode = await proc.exited;
    tmuxAvailable = exitCode === 0;
  } catch {
    tmuxAvailable = false;
  }
});

// ── Test SessionManager that spawns bash instead of CLI tools ──

class TestSessionManager extends SessionManager {
  protected override resolveSpawnCommand(
    _providerId: string,
    _model: string,
  ): { command: string; args: string[] } {
    return { command: "bash", args: [] };
  }
}

// ── Test helpers ────────────────────────────────────────────

let dataDir: string;
let database: AppDatabase;
let tmux: TmuxService;
let sessionManager: SessionManager;
let app: Hono;

function createTestApp() {
  const routes = createSessionRoutes(sessionManager);
  const testApp = new Hono();
  testApp.route("/api/v1/sessions", routes);
  return testApp;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = any;

async function req(
  method: string,
  path: string,
  body?: Record<string, unknown>,
): Promise<{ status: number; json: () => Promise<Json> }> {
  const init: RequestInit = { method, headers: {} };
  if (body) {
    init.body = JSON.stringify(body);
    (init.headers as Record<string, string>)["Content-Type"] = "application/json";
  }
  const res = await app.request(path, init);
  return {
    status: res.status,
    json: () => res.json() as Promise<Json>,
  };
}

beforeEach(() => {
  dataDir = mkdtempSync(join(tmpdir(), "codemobile-session-test-"));
  database = new AppDatabase(dataDir);
  database.runMigrations();
  tmux = new TmuxService();
  sessionManager = new TestSessionManager(database.db, tmux, dataDir);
  app = createTestApp();
});

afterEach(async () => {
  // Clean up any tmux sessions we created
  if (tmuxAvailable) {
    try {
      const sessions = await tmux.listSessions();
      for (const s of sessions) {
        if (s.name.startsWith("cm-") || s.name.startsWith("test-")) {
          await tmux.killSession(s.name);
        }
      }
    } catch {
      // ignore — server may not be running
    }
  }

  sessionManager.stopAll();
  database.close();
  rmSync(dataDir, { recursive: true, force: true });
});

// ── TmuxService Unit Tests ──────────────────────────────────

describe("TmuxService", () => {
  test("listSessions returns empty array when no sessions exist", async () => {
    if (!tmuxAvailable) return;
    // When tmux server isn't running, listSessions handles it gracefully
    const sessions = await tmux.listSessions();
    expect(Array.isArray(sessions)).toBe(true);
  });

  test("createSession and killSession work", async () => {
    if (!tmuxAvailable) return;

    await tmux.createSession("test-basic", "bash", ["-c", "sleep 60"], {});
    const has = await tmux.hasSession("test-basic");
    expect(has).toBe(true);

    await tmux.killSession("test-basic");
    const hasAfter = await tmux.hasSession("test-basic");
    expect(hasAfter).toBe(false);
  });

  test("capturePane returns terminal content", async () => {
    if (!tmuxAvailable) return;

    await tmux.createSession("test-capture", "bash", [], {});
    await new Promise((r) => setTimeout(r, 300));

    // Send an echo command and wait for output
    await tmux.sendText("test-capture", "echo CAPTURE_TEST");
    await tmux.sendKeys("test-capture", "Enter");
    await new Promise((r) => setTimeout(r, 500));

    const output = await tmux.capturePane("test-capture");
    expect(output).toContain("CAPTURE_TEST");

    await tmux.killSession("test-capture");
  });

  test("sendText and sendKeys work", async () => {
    if (!tmuxAvailable) return;

    await tmux.createSession("test-keys", "bash", [], {});
    await new Promise((r) => setTimeout(r, 300));

    await tmux.sendText("test-keys", "echo TYPED_TEXT");
    await tmux.sendKeys("test-keys", "Enter");
    await new Promise((r) => setTimeout(r, 500));

    const output = await tmux.capturePane("test-keys");
    expect(output).toContain("TYPED_TEXT");

    await tmux.killSession("test-keys");
  });

  test("hasSession returns false for nonexistent session", async () => {
    if (!tmuxAvailable) return;
    const has = await tmux.hasSession("nonexistent-session-xyz");
    expect(has).toBe(false);
  });

  test("killSession throws for missing session", async () => {
    if (!tmuxAvailable) return;
    try {
      await tmux.killSession("nonexistent-session-xyz");
      expect(true).toBe(false); // should not reach
    } catch (err) {
      expect(err).toBeInstanceOf(TmuxError);
      // May be SESSION_NOT_FOUND or SERVER_NOT_RUNNING depending on tmux state
      expect(["SESSION_NOT_FOUND", "SERVER_NOT_RUNNING"]).toContain(
        (err as TmuxError).code,
      );
    }
  });

  test("pipePaneToFile captures output", async () => {
    if (!tmuxAvailable) return;

    const outputFile = join(dataDir, "pipe-test.log");
    await tmux.createSession("test-pipe", "bash", [], {});
    await new Promise((r) => setTimeout(r, 300));
    await tmux.pipePaneToFile("test-pipe", outputFile);

    // Send something to produce output
    await tmux.sendText("test-pipe", "echo PIPE_OUTPUT");
    await tmux.sendKeys("test-pipe", "Enter");

    // Wait for pipe to capture
    await new Promise((r) => setTimeout(r, 1000));

    expect(existsSync(outputFile)).toBe(true);
    const content = readFileSync(outputFile, "utf-8");
    expect(content.length).toBeGreaterThan(0);

    await tmux.killSession("test-pipe");
  });

  test("resizeWindow works", async () => {
    if (!tmuxAvailable) return;

    await tmux.createSession("test-resize", "bash", [], {});
    // Should not throw
    await tmux.resizeWindow("test-resize", 80, 24);
    await tmux.killSession("test-resize");
  });

  test("createSession with env vars", async () => {
    if (!tmuxAvailable) return;

    await tmux.createSession("test-env", "bash", [], { MY_VAR: "hello_world" });
    await new Promise((r) => setTimeout(r, 300));

    await tmux.sendText("test-env", "echo $MY_VAR");
    await tmux.sendKeys("test-env", "Enter");
    await new Promise((r) => setTimeout(r, 500));

    const output = await tmux.capturePane("test-env");
    expect(output).toContain("hello_world");

    await tmux.killSession("test-env");
  });
});

// ── SessionStreamer Tests ───────────────────────────────────

describe("SessionStreamer", () => {
  test("getHistory returns empty for empty file", async () => {
    const outputFile = join(dataDir, "streamer-test.log");
    await Bun.write(outputFile, "");
    const streamer = new SessionStreamer("test-id", outputFile);

    const history = await streamer.getHistory(0);
    expect(history.bytes.length).toBe(0);
    expect(history.offset).toBe(0);

    streamer.stop();
  });

  test("getHistory returns file content from offset", async () => {
    const outputFile = join(dataDir, "streamer-test2.log");
    await Bun.write(outputFile, "hello world\n");
    const streamer = new SessionStreamer("test-id", outputFile);

    const history = await streamer.getHistory(0);
    const text = new TextDecoder().decode(history.bytes);
    expect(text).toBe("hello world\n");
    expect(history.offset).toBe(0);

    // Read from offset 6
    const partial = await streamer.getHistory(6);
    const partialText = new TextDecoder().decode(partial.bytes);
    expect(partialText).toBe("world\n");

    streamer.stop();
  });

  test("emits data events when file is appended to", async () => {
    const outputFile = join(dataDir, "streamer-test3.log");
    await Bun.write(outputFile, "");
    const streamer = new SessionStreamer("test-id", outputFile);
    streamer.start();

    const chunks: { bytes: Uint8Array; offset: number }[] = [];
    streamer.on("data", (chunk: { bytes: Uint8Array; offset: number }) => {
      chunks.push(chunk);
    });

    // Append data using Bun.write (append mode via writing more data)
    const fd = Bun.file(outputFile).writer();
    fd.write("first chunk\n");
    fd.flush();

    await new Promise((r) => setTimeout(r, 200));

    fd.write("second chunk\n");
    fd.flush();

    await new Promise((r) => setTimeout(r, 200));
    fd.end();

    expect(chunks.length).toBeGreaterThanOrEqual(1);
    const allText = chunks.map((c) => new TextDecoder().decode(c.bytes)).join("");
    expect(allText).toContain("first chunk");
    expect(allText).toContain("second chunk");

    streamer.stop();
  });
});

// ── SessionManager Tests ────────────────────────────────────

describe("SessionManager", () => {
  test("listSessions returns empty initially", () => {
    const sessions = sessionManager.listSessions();
    expect(sessions).toEqual([]);
  });

  test("getSession returns null for nonexistent session", () => {
    const session = sessionManager.getSession("nonexistent-id");
    expect(session).toBeNull();
  });

  test(
    "listSessions filters by status",
    async () => {
      if (!tmuxAvailable) return;

      const session = await sessionManager.createSession({
        providerId: "claude-code",
        name: "test-filter",
      });

      const running = sessionManager.listSessions("running");
      expect(running.length).toBe(1);

      const stopped = sessionManager.listSessions("stopped");
      expect(stopped.length).toBe(0);

      await sessionManager.stopSession(session.id);

      const afterStop = sessionManager.listSessions("stopped");
      expect(afterStop.length).toBe(1);
    },
    15000,
  );
});

// ── Integration: Create session with echo hello ─────────────

describe("Integration: session lifecycle", () => {
  test(
    "creates session, sends input, captures output, and stops",
    async () => {
      if (!tmuxAvailable) return;

      // Create a session (TestSessionManager spawns bash)
      const session = await sessionManager.createSession({
        providerId: "claude-code",
        name: "test-echo",
      });

      expect(session.id).toBeDefined();
      expect(session.status).toBe("running");
      expect(session.tmuxSessionName).toMatch(/^cm-/);

      // Verify tmux session exists
      const exists = await tmux.hasSession(session.tmuxSessionName);
      expect(exists).toBe(true);

      // Verify DB record
      const dbSession = sessionManager.getSession(session.id);
      expect(dbSession).not.toBeNull();
      expect(dbSession?.status).toBe("running");

      // Verify streamer is active
      const streamer = sessionManager.getStreamer(session.id);
      expect(streamer).toBeDefined();

      // Send echo command
      await sessionManager.sendInput(session.id, "echo 'HELLO_FROM_TEST'");
      await sessionManager.sendKeys(session.id, "Enter");

      // Wait for pipe-pane to capture the output
      await new Promise((r) => setTimeout(r, 1500));

      // Check output via streamer
      const history = await streamer?.getHistory(0);
      const text = new TextDecoder().decode(history?.bytes ?? new Uint8Array());
      expect(text).toContain("HELLO_FROM_TEST");

      // Stop the session
      await sessionManager.stopSession(session.id);

      // Verify session is stopped in DB
      const stoppedSession = sessionManager.getSession(session.id);
      expect(stoppedSession?.status).toBe("stopped");
    },
    15000,
  );

  test(
    "output streaming captures real-time data",
    async () => {
      if (!tmuxAvailable) return;

      const session = await sessionManager.createSession({
        providerId: "claude-code",
        name: "test-stream",
      });

      // Type something that produces output
      await sessionManager.sendInput(session.id, "echo STREAM_TEST_123");
      await sessionManager.sendKeys(session.id, "Enter");

      // Wait for pipe-pane
      await new Promise((r) => setTimeout(r, 1500));

      const streamer = sessionManager.getStreamer(session.id);
      expect(streamer).toBeDefined();
      const history = await streamer?.getHistory(0);
      const bytes = history?.bytes ?? new Uint8Array();
      const text = new TextDecoder().decode(bytes);

      expect(bytes.length).toBeGreaterThan(0);
      expect(text).toContain("STREAM_TEST_123");

      await sessionManager.stopSession(session.id);
    },
    15000,
  );

  test(
    "resize terminal works",
    async () => {
      if (!tmuxAvailable) return;

      const session = await sessionManager.createSession({
        providerId: "claude-code",
        name: "test-resize-mgr",
      });

      // Should not throw
      await sessionManager.resizeTerminal(session.id, 80, 24);

      await sessionManager.stopSession(session.id);
    },
    15000,
  );
});

// ── Session HTTP Routes Tests ───────────────────────────────

describe("Session HTTP Routes", () => {
  test("POST / returns 400 without providerId", async () => {
    const res = await req("POST", "/api/v1/sessions", {});
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error.code).toBe("VALIDATION_ERROR");
  });

  test("GET / returns empty session list", async () => {
    const res = await req("GET", "/api/v1/sessions");
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data).toEqual([]);
  });

  test("GET /:id returns 404 for nonexistent session", async () => {
    const res = await req("GET", "/api/v1/sessions/nonexistent");
    expect(res.status).toBe(404);
  });

  test("DELETE /:id returns 404 for nonexistent session", async () => {
    const res = await req("DELETE", "/api/v1/sessions/nonexistent");
    expect(res.status).toBe(404);
  });

  test("POST /:id/input returns 400 without text", async () => {
    const res = await req("POST", "/api/v1/sessions/fake-id/input", {});
    expect(res.status).toBe(400);
  });

  test("POST /:id/keys returns 400 without keys", async () => {
    const res = await req("POST", "/api/v1/sessions/fake-id/keys", {});
    expect(res.status).toBe(400);
  });

  test("POST /:id/resize returns 400 without dimensions", async () => {
    const res = await req("POST", "/api/v1/sessions/fake-id/resize", {});
    expect(res.status).toBe(400);
  });

  test("full HTTP lifecycle works", async () => {
    if (!tmuxAvailable) return;
    // Timeout handled by Bun test runner (see below)

    // Create session (TestSessionManager spawns bash)
    const createRes = await req("POST", "/api/v1/sessions", {
      providerId: "claude-code",
      name: "http-test",
    });
    expect(createRes.status).toBe(201);
    const createJson = await createRes.json();
    expect(createJson.success).toBe(true);
    const sessionId = createJson.data.id;

    // List sessions
    const listRes = await req("GET", "/api/v1/sessions");
    const listJson = await listRes.json();
    expect(listJson.data.length).toBe(1);

    // Get session detail
    const getRes = await req("GET", `/api/v1/sessions/${sessionId}`);
    expect(getRes.status).toBe(200);
    const getJson = await getRes.json();
    expect(getJson.data.id).toBe(sessionId);
    expect(getJson.data.status).toBe("running");

    // Send input
    const inputRes = await req("POST", `/api/v1/sessions/${sessionId}/input`, {
      text: "echo hello",
    });
    expect(inputRes.status).toBe(200);

    // Send keys
    const keysRes = await req("POST", `/api/v1/sessions/${sessionId}/keys`, {
      keys: "Enter",
    });
    expect(keysRes.status).toBe(200);

    await new Promise((r) => setTimeout(r, 500));

    // Get output
    const outputRes = await req("GET", `/api/v1/sessions/${sessionId}/output?offset=0`);
    expect(outputRes.status).toBe(200);
    const outputJson = await outputRes.json();
    expect(outputJson.success).toBe(true);

    // Stop session
    const deleteRes = await req("DELETE", `/api/v1/sessions/${sessionId}`);
    expect(deleteRes.status).toBe(200);

    // Verify stopped
    const stoppedRes = await req("GET", `/api/v1/sessions/${sessionId}`);
    const stoppedJson = await stoppedRes.json();
    expect(stoppedJson.data.status).toBe("stopped");
  }, 15000);
});
