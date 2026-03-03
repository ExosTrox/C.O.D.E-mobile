// ── Notification Routes ─────────────────────────────────────
// POST /subscribe — store push subscription
// DELETE /unsubscribe — remove push subscription
// GET /vapid-key — get VAPID public key

import { Hono } from "hono";
import type { ApiResponse } from "@code-mobile/core";
import type { NotificationService } from "./notification.service.js";

export function createNotificationRoutes(notificationService: NotificationService) {
  const router = new Hono();

  // GET /vapid-key — public endpoint for VAPID key
  router.get("/vapid-key", (c) => {
    const publicKey = notificationService.getVapidPublicKey();
    const body: ApiResponse<{ publicKey: string }> = {
      success: true,
      data: { publicKey },
    };
    return c.json(body);
  });

  // POST /subscribe — store push subscription
  router.post("/subscribe", async (c) => {
    const payload = await c.req.json();
    const userId = c.get("user")?.sub ?? "anonymous";

    if (!payload.endpoint || !payload.keys?.p256dh || !payload.keys?.auth) {
      const body: ApiResponse<never> = {
        success: false,
        error: { code: "INVALID_SUBSCRIPTION", message: "Invalid push subscription format" },
      };
      return c.json(body, 400);
    }

    notificationService.subscribe(userId, {
      endpoint: payload.endpoint,
      keys: { p256dh: payload.keys.p256dh, auth: payload.keys.auth },
    });

    const body: ApiResponse<{ subscribed: true }> = {
      success: true,
      data: { subscribed: true },
    };
    return c.json(body);
  });

  // DELETE /unsubscribe
  router.delete("/unsubscribe", async (c) => {
    const { endpoint } = await c.req.json();
    if (!endpoint) {
      const body: ApiResponse<never> = {
        success: false,
        error: { code: "MISSING_ENDPOINT", message: "Endpoint required" },
      };
      return c.json(body, 400);
    }

    notificationService.unsubscribe(endpoint);
    const body: ApiResponse<{ unsubscribed: true }> = {
      success: true,
      data: { unsubscribed: true },
    };
    return c.json(body);
  });

  return router;
}
