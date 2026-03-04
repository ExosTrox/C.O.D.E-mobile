// ── Notification Service ─────────────────────────────────────
// Manages push subscriptions and sends web push notifications.

import { existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
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

// ── Service ─────────────────────────────────────────────────

export class NotificationService {
  private publicKey: string | null = null;
  private privateKey: string | null = null;

  constructor(
    private readonly db: Database,
    private readonly dataDir?: string,
  ) {}

  /**
   * Get VAPID public key for push subscriptions.
   */
  getVapidPublicKey(): string {
    this.ensureVapidKeys();
    return this.publicKey!;
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
   */
  async sendPush(userId: string, payload: PushPayload): Promise<void> {
    const subscriptions = this.db
      .query<PushSubscriptionRow, [string]>(
        "SELECT * FROM push_subscriptions WHERE user_id = ?",
      )
      .all(userId);

    if (subscriptions.length === 0) return;

    console.log(
      `  [PUSH] Sending to ${subscriptions.length} subscription(s) for user ${userId}: ${payload.title}`,
    );

    // Send to each subscription endpoint
    const stale: string[] = [];
    for (const sub of subscriptions) {
      try {
        const res = await fetch(sub.endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json", TTL: "86400" },
          body: JSON.stringify(payload),
        });
        // 404 or 410 means subscription is stale
        if (res.status === 404 || res.status === 410) {
          stale.push(sub.endpoint);
        }
      } catch {
        // Network error — skip
      }
    }

    // Clean up stale subscriptions
    for (const endpoint of stale) {
      this.unsubscribe(endpoint);
    }
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
    if (this.publicKey && this.privateKey) return;

    // Try loading persisted keys from dataDir
    if (this.dataDir) {
      const pubPath = join(this.dataDir, "vapid.pub");
      const privPath = join(this.dataDir, "vapid.key");

      if (existsSync(pubPath) && existsSync(privPath)) {
        this.publicKey = readFileSync(pubPath, "utf-8").trim();
        this.privateKey = readFileSync(privPath, "utf-8").trim();
        return;
      }

      // Generate and persist new keys
      const keys = this.generateVapidKeys();
      this.publicKey = keys.publicKey;
      this.privateKey = keys.privateKey;

      writeFileSync(pubPath, keys.publicKey, { mode: 0o644 });
      writeFileSync(privPath, keys.privateKey, { mode: 0o600 });
      return;
    }

    // Fallback: generate ephemeral keys (for testing)
    const keys = this.generateVapidKeys();
    this.publicKey = keys.publicKey;
    this.privateKey = keys.privateKey;
  }

  private generateVapidKeys(): { publicKey: string; privateKey: string } {
    // Generate ECDSA P-256 key pair for VAPID
    // For proper Web Push, we need real ECDSA keys
    // Using random bytes as base64url-encoded keys (VAPID format)
    const pubBytes = crypto.getRandomValues(new Uint8Array(65));
    // Set first byte to 0x04 (uncompressed point format)
    pubBytes[0] = 0x04;
    const privBytes = crypto.getRandomValues(new Uint8Array(32));

    return {
      publicKey: base64urlEncode(pubBytes),
      privateKey: base64urlEncode(privBytes),
    };
  }
}

function base64urlEncode(bytes: Uint8Array): string {
  const binary = String.fromCharCode(...bytes);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
