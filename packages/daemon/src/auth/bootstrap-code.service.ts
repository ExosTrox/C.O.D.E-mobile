// ── Bootstrap Code Service ─────────────────────────────────
// Generates and validates one-time access codes.
// Used by OpenClaw (or any internal caller) to grant web access.

export interface BootstrapCode {
  code: string;
  createdAt: number;
  expiresAt: number;
  redeemed: boolean;
}

export class BootstrapCodeService {
  private codes = new Map<string, BootstrapCode>();
  private readonly TTL_MS = 5 * 60 * 1000; // 5 minutes

  /** Generate a 6-character alphanumeric code */
  generate(): string {
    this.cleanup();

    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no O/0/1/I for readability
    const bytes = crypto.getRandomValues(new Uint8Array(6));
    const code = Array.from(bytes)
      .map((b) => chars[b % chars.length])
      .join("");

    const now = Date.now();
    this.codes.set(code, {
      code,
      createdAt: now,
      expiresAt: now + this.TTL_MS,
      redeemed: false,
    });

    return code;
  }

  /** Validate and consume a code (single-use) */
  redeem(code: string): boolean {
    this.cleanup();

    const entry = this.codes.get(code.toUpperCase());
    if (!entry) return false;
    if (entry.redeemed) return false;
    if (Date.now() > entry.expiresAt) return false;

    entry.redeemed = true;
    this.codes.delete(code.toUpperCase());
    return true;
  }

  /** Remove expired codes */
  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.codes) {
      if (now > entry.expiresAt) {
        this.codes.delete(key);
      }
    }
  }
}
