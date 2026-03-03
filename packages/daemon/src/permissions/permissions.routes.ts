// ── Permission HTTP Routes ──────────────────────────────────
// Mounted at /api/v1/sessions/:id/permissions

import { Hono } from "hono";
import type { ApiResponse } from "@code-mobile/core";
import type { DecodedToken } from "../auth/auth.service.js";
import type { PermissionService, PermissionAction } from "./permissions.service.js";

interface PermEnv {
  Variables: {
    requestId: string;
    user: DecodedToken;
  };
}

export function createPermissionRoutes(permissionService: PermissionService): Hono<PermEnv> {
  const router = new Hono<PermEnv>();

  // ── GET /:id/permissions — list policies ────────────────
  router.get("/:id/permissions", (c) => {
    const sessionId = c.req.param("id");
    const policies = permissionService.listPolicies(sessionId);
    const body: ApiResponse<typeof policies> = { success: true, data: policies };
    return c.json(body);
  });

  // ── PUT /:id/permissions — update policies ──────────────
  router.put("/:id/permissions", async (c) => {
    const sessionId = c.req.param("id");
    const { policies } = await c.req.json<{
      policies: { tool: string; pathPattern?: string; action: PermissionAction }[];
    }>();

    if (!Array.isArray(policies)) {
      const body: ApiResponse<never> = {
        success: false,
        error: { code: "VALIDATION_ERROR", message: "policies must be an array" },
      };
      return c.json(body, 400);
    }

    // Validate actions
    for (const p of policies) {
      if (!["allow", "deny", "ask"].includes(p.action)) {
        const body: ApiResponse<never> = {
          success: false,
          error: { code: "VALIDATION_ERROR", message: `Invalid action: ${p.action}` },
        };
        return c.json(body, 400);
      }
    }

    permissionService.setPolicies(sessionId, policies);
    const updated = permissionService.listPolicies(sessionId);
    const body: ApiResponse<typeof updated> = { success: true, data: updated };
    return c.json(body);
  });

  // ── POST /:id/permissions/respond — respond to request ──
  router.post("/:id/permissions/respond", async (c) => {
    const { requestId, decision } = await c.req.json<{
      requestId: string;
      decision: "allow" | "deny";
    }>();

    if (!requestId || !decision) {
      const body: ApiResponse<never> = {
        success: false,
        error: { code: "VALIDATION_ERROR", message: "requestId and decision are required" },
      };
      return c.json(body, 400);
    }

    if (decision !== "allow" && decision !== "deny") {
      const body: ApiResponse<never> = {
        success: false,
        error: { code: "VALIDATION_ERROR", message: "decision must be 'allow' or 'deny'" },
      };
      return c.json(body, 400);
    }

    const status = decision === "allow" ? "allowed" : "denied";
    const result = permissionService.resolveRequest(requestId, status);

    if (!result) {
      const body: ApiResponse<never> = {
        success: false,
        error: { code: "NOT_FOUND", message: "Permission request not found or already resolved" },
      };
      return c.json(body, 404);
    }

    const body: ApiResponse<typeof result> = { success: true, data: result };
    return c.json(body);
  });

  // ── GET /:id/permissions/pending — list pending requests ─
  router.get("/:id/permissions/pending", (c) => {
    const sessionId = c.req.param("id");
    const pending = permissionService.getPendingRequests(sessionId);
    const body: ApiResponse<typeof pending> = { success: true, data: pending };
    return c.json(body);
  });

  return router;
}
