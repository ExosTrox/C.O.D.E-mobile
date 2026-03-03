// ── Internal Hook Routes ──────────────────────────────────────
// Receives callbacks from Claude Code hooks (bash scripts).
// Mounted at /internal/hooks/:sessionId/*
// These routes are NOT authenticated — they're only called from localhost by hook scripts.

import { Hono } from "hono";
import type { PermissionService } from "../permissions/permissions.service.js";

interface HookPayload {
  tool_name?: string;
  tool_input?: Record<string, unknown>;
  [key: string]: unknown;
}

export function createHookRoutes(permissionService: PermissionService): Hono {
  const router = new Hono();

  // ── Pre-tool-use: evaluate permission and optionally block ──
  router.post("/:sessionId/pre-tool-use", async (c) => {
    const sessionId = c.req.param("sessionId");
    const payload = await c.req.json<HookPayload>();

    const tool = payload.tool_name ?? "unknown";
    const input = payload.tool_input ?? {};

    const action = permissionService.evaluatePolicy(sessionId, tool, input);

    if (action === "deny") {
      return c.json({ action: "deny", message: "Blocked by permission policy" });
    }

    if (action === "ask") {
      // Create a pending permission request for the mobile UI to display
      const request = permissionService.createRequest(
        sessionId,
        tool,
        JSON.stringify(input),
      );

      // Wait for resolution (poll up to 30 seconds)
      const resolved = await waitForResolution(permissionService, request.id, 30_000);

      if (!resolved || resolved.status === "denied" || resolved.status === "expired") {
        return c.json({ action: "deny", message: "Permission denied or timed out" });
      }

      return c.json({ action: "allow" });
    }

    // action === "allow"
    return c.json({ action: "allow" });
  });

  // ── Post-tool-use: fire-and-forget analytics/logging ────────
  router.post("/:sessionId/post-tool-use", async (c) => {
    // Just acknowledge — analytics are parsed from output stream
    return c.json({ ok: true });
  });

  // ── Notification: forward to WebSocket clients ──────────────
  router.post("/:sessionId/notification", async (c) => {
    // Will be used to broadcast notifications via WebSocket
    return c.json({ ok: true });
  });

  // ── Stop: session ending notification ───────────────────────
  router.post("/:sessionId/stop", async (c) => {
    // Will be used to update session status
    return c.json({ ok: true });
  });

  return router;
}

// ── Helpers ─────────────────────────────────────────────────

async function waitForResolution(
  permissionService: PermissionService,
  requestId: string,
  timeoutMs: number,
): Promise<ReturnType<PermissionService["getRequest"]>> {
  const deadline = Date.now() + timeoutMs;
  const pollInterval = 500;

  while (Date.now() < deadline) {
    const request = permissionService.getRequest(requestId);
    if (request && request.status !== "pending") {
      return request;
    }
    await new Promise((resolve) => setTimeout(resolve, pollInterval));
  }

  // Expire the request on timeout
  permissionService.resolveRequest(requestId, "denied");
  return permissionService.getRequest(requestId);
}
