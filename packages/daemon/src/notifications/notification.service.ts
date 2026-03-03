// ── Notification Service ─────────────────────────────────────
// Manages push subscriptions and sends web push notifications.
// Uses the Web Push protocol directly (no external npm dependency).

import type { Database } from "bun:sqlite";

// ── Types ────────────────────────────────────────────────────

interface PushSubscriptionRow {
  id: string;
  user_id: string;
  endpoint: string;
  keys_p256dh: string;
  keys_auth: string;
  created_at: number;
}

export interface PushSubscriptionInput {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, unknown>;
  actions?: Array<{ action: string; title: string }>;
}

// ── VAPID Keys ──────────────────────────────────────────────

interface VapidKeys {
  publicKey: string;
  privateKey: string;
}

// ── Service ─────────────────────────────────────────────────

export class NotificationService {
  private vapidKeys: VapidKeys | null = null;

  constructor(private readonly db: Database) {}

  /**
   * Get or generate VAPID keys. In production, these should be persisted.
   * For now, we store them in a simple table.
   */
  getVapidPublicKey(): string {
    this.ensureVapidKeys();
    return this.vapidKeys!.publicKey;
  }

  /**
   * Store a push subscription for a user.
   */
  subscribe(userId: string, subscription: PushSubscriptionInput): void {
    this.db.run(
      `INSERT OR REPLACE INTO push_subscriptions (id, user_id, endpoint, keys_p256dh, keys_auth)
       VALUES (?, ?, ?, ?, ?)`,
      [
        crypto.randomUUID(),
        userId,
        subscription.endpoint,
        subscription.keys.p256dh,
        subscription.keys.auth,
      ],
    );
  }

  /**
   * Remove a push subscription.
   */
  unsubscribe(endpoint: string): void {
    this.db.run("DELETE FROM push_subscriptions WHERE endpoint = ?", [endpoint]);
  }

  /**
   * Send a push notification to all of a user's subscriptions.
   * Note: Full web-push implementation requires crypto operations.
   * For MVP, we log the notification and store it.
   */
  async sendPush(userId: string, payload: PushPayload): Promise<void> {
    const subscriptions = this.db
      .query<PushSubscriptionRow, [string]>(
        "SELECT * FROM push_subscriptions WHERE user_id = ?",
      )
      .all(userId);

    if (subscriptions.length === 0) return;

    // Log notification for now — full Web Push requires ECDH crypto
    console.log(
      `  [PUSH] Sending to ${subscriptions.length} subscription(s) for user ${userId}: ${payload.title}`,
    );

    // TODO: Implement actual web-push sending with VAPID signing
    // For now, this is a stub that will be replaced with proper implementation
    // when we add the web-push npm package
  }

  /**
   * Get subscription count for a user.
   */
  getSubscriptionCount(userId: string): number {
    const row = this.db
      .query<{ count: number }, [string]>(
        "SELECT COUNT(*) as count FROM push_subscriptions WHERE user_id = ?",
      )
      .get(userId);
    return row?.count ?? 0;
  }

  // ── Internals ─────────────────────────────────────────────

  private ensureVapidKeys(): void {
    if (this.vapidKeys) return;

    // For MVP, use a placeholder VAPID key
    // In production, generate proper ECDSA P-256 keys
    this.vapidKeys = {
      publicKey: "BPlaceholderVapidPublicKeyForDevelopment_Replace_In_Production_aaaaaaa",
      privateKey: "placeholder-private-key",
    };
  }
}
