// ── Session HTTP Routes ─────────────────────────────────────
// Mounted at /api/v1/sessions

import { Hono } from "hono";
import type { ApiResponse, SessionStatus } from "@code-mobile/core";
import type { DecodedToken } from "../auth/auth.service.js";
import type { SessionManager } from "./session.manager.js";

interface SessionEnv {
  Variables: {
    requestId: string;
    user: DecodedToken;
  };
}

export function createSessionRoutes(sessionManager: SessionManager): Hono<SessionEnv> {
  const router = new Hono<SessionEnv>();

  // ── POST / — create session ─────────────────────────────
  router.post("/", async (c) => {
    const userId = c.get("user").sub;
    const { providerId, name, model, workDir, envVars } = await c.req.json<{
      providerId: string;
      name?: string;
      model?: string;
      workDir?: string;
      envVars?: Record<string, string>;
    }>();

    if (!providerId) {
      const body: ApiResponse<never> = {
        success: false,
        error: { code: "VALIDATION_ERROR", message: "providerId is required" },
      };
      return c.json(body, 400);
    }

    try {
      const session = await sessionManager.createSession({
        providerId: providerId as Parameters<typeof sessionManager.createSession>[0]["providerId"],
        name,
        model,
        workDir,
        envVars,
      }, userId);

      const body: ApiResponse<typeof session> = { success: true, data: session };
      return c.json(body, 201);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create session";
      const isMachineError = message.includes("No machine paired");
      const body: ApiResponse<never> = {
        success: false,
        error: {
          code: isMachineError ? "MACHINE_NOT_PAIRED" : "SESSION_CREATE_FAILED",
          message,
        },
      };
      return c.json(body, isMachineError ? 400 : 500);
    }
  });

  // ── GET / — list sessions ───────────────────────────────
  router.get("/", (c) => {
    const userId = c.get("user").sub;
    const status = c.req.query("status") as SessionStatus | undefined;
    const provider = c.req.query("provider");

    const sessions = sessionManager.listSessions(status, provider, userId);
    const body: ApiResponse<typeof sessions> = { success: true, data: sessions };
    return c.json(body);
  });

  // ── GET /:id — session detail ───────────────────────────
  router.get("/:id", (c) => {
    const userId = c.get("user").sub;
    const id = c.req.param("id");
    if (!sessionManager.isSessionOwner(id, userId)) {
      const body: ApiResponse<never> = {
        success: false,
        error: { code: "NOT_FOUND", message: "Session not found" },
      };
      return c.json(body, 404);
    }

    const session = sessionManager.getSession(id);
    if (!session) {
      const body: ApiResponse<never> = {
        success: false,
        error: { code: "NOT_FOUND", message: "Session not found" },
      };
      return c.json(body, 404);
    }

    const body: ApiResponse<typeof session> = { success: true, data: session };
    return c.json(body);
  });

  // ── DELETE /:id — stop session ──────────────────────────
  router.delete("/:id", async (c) => {
    const userId = c.get("user").sub;
    const id = c.req.param("id");
    if (!sessionManager.isSessionOwner(id, userId)) {
      const body: ApiResponse<never> = {
        success: false,
        error: { code: "NOT_FOUND", message: "Session not found" },
      };
      return c.json(body, 404);
    }
    const session = sessionManager.getSession(id);
    if (!session) {
      const body: ApiResponse<never> = {
        success: false,
        error: { code: "NOT_FOUND", message: "Session not found" },
      };
      return c.json(body, 404);
    }

    try {
      await sessionManager.stopSession(id);
      const body: ApiResponse<{ message: string }> = {
        success: true,
        data: { message: "Session stopped" },
      };
      return c.json(body);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to stop session";
      const body: ApiResponse<never> = {
        success: false,
        error: { code: "SESSION_STOP_FAILED", message },
      };
      return c.json(body, 500);
    }
  });

  // ── POST /:id/input — send literal text ─────────────────
  router.post("/:id/input", async (c) => {
    const { text } = await c.req.json<{ text: string }>();
    if (!text) {
      const body: ApiResponse<never> = {
        success: false,
        error: { code: "VALIDATION_ERROR", message: "text is required" },
      };
      return c.json(body, 400);
    }

    try {
      await sessionManager.sendInput(c.req.param("id"), text);
      const body: ApiResponse<{ message: string }> = {
        success: true,
        data: { message: "Input sent" },
      };
      return c.json(body);
    } catch (err) {
      return sessionError(c, err);
    }
  });

  // ── POST /:id/keys — send special keys ──────────────────
  router.post("/:id/keys", async (c) => {
    const { keys } = await c.req.json<{ keys: string }>();
    if (!keys) {
      const body: ApiResponse<never> = {
        success: false,
        error: { code: "VALIDATION_ERROR", message: "keys is required" },
      };
      return c.json(body, 400);
    }

    try {
      await sessionManager.sendKeys(c.req.param("id"), keys);
      const body: ApiResponse<{ message: string }> = {
        success: true,
        data: { message: "Keys sent" },
      };
      return c.json(body);
    } catch (err) {
      return sessionError(c, err);
    }
  });

  // ── POST /:id/resize — resize terminal ──────────────────
  router.post("/:id/resize", async (c) => {
    const { cols, rows } = await c.req.json<{ cols: number; rows: number }>();
    if (!cols || !rows || cols < 1 || rows < 1) {
      const body: ApiResponse<never> = {
        success: false,
        error: { code: "VALIDATION_ERROR", message: "cols and rows must be positive integers" },
      };
      return c.json(body, 400);
    }

    try {
      await sessionManager.resizeTerminal(c.req.param("id"), cols, rows);
      const body: ApiResponse<{ message: string }> = {
        success: true,
        data: { message: "Terminal resized" },
      };
      return c.json(body);
    } catch (err) {
      return sessionError(c, err);
    }
  });

  // ── GET /:id/output — buffered output from offset ───────
  router.get("/:id/output", async (c) => {
    const id = c.req.param("id");
    const offset = parseInt(c.req.query("offset") ?? "0", 10);

    const streamer = sessionManager.getStreamer(id);
    if (!streamer) {
      // No active streamer — try to read from file directly
      const session = sessionManager.getSession(id);
      if (!session) {
        const body: ApiResponse<never> = {
          success: false,
          error: { code: "NOT_FOUND", message: "Session not found" },
        };
        return c.json(body, 404);
      }

      const body: ApiResponse<{ output: string; offset: number; size: number }> = {
        success: true,
        data: { output: "", offset, size: 0 },
      };
      return c.json(body);
    }

    const { bytes, offset: startOffset } = await streamer.getHistory(offset);
    const output = new TextDecoder().decode(bytes);

    const body: ApiResponse<{ output: string; offset: number; size: number }> = {
      success: true,
      data: {
        output,
        offset: startOffset,
        size: startOffset + bytes.length,
      },
    };
    return c.json(body);
  });

  return router;
}

// ── Helpers ─────────────────────────────────────────────────

function sessionError(c: { json: (body: unknown, status: number) => Response }, err: unknown) {
  const message = err instanceof Error ? err.message : "Session operation failed";
  const code = message.includes("not found") ? "NOT_FOUND" : "SESSION_ERROR";
  const status = code === "NOT_FOUND" ? 404 : 500;
  const body: ApiResponse<never> = { success: false, error: { code, message } };
  return c.json(body, status);
}
