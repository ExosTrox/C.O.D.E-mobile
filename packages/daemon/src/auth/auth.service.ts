import { SignJWT, jwtVerify } from "jose";
import type { JWTPayload } from "jose";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import type { Database } from "bun:sqlite";

// ── Types ────────────────────────────────────────────────────

export interface DecodedToken extends JWTPayload {
  sub: string;
  device: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

interface RefreshTokenRow {
  id: string;
  user_id: string;
  device_id: string;
  token_hash: string;
  expires_at: number;
}

interface UserRow {
  id: string;
  username: string;
  password_hash: string;
  totp_secret: string | null;
  created_at: number;
}

// ── AuthService ──────────────────────────────────────────────

export class AuthService {
  private jwtSecret: Uint8Array;
  private bootstrapToken: string | null = null;
  private readonly db: Database;

  constructor(db: Database, dataDir: string) {
    this.db = db;
    this.jwtSecret = this.loadOrCreateJwtSecret(dataDir);
  }

  // ── JWT Secret Management ─────────────────────────────────

  private loadOrCreateJwtSecret(dataDir: string): Uint8Array {
    const secretPath = join(dataDir, "jwt.secret");

    if (existsSync(secretPath)) {
      const hex = readFileSync(secretPath, "utf-8").trim();
      return new Uint8Array(Buffer.from(hex, "hex"));
    }

    // Generate a 256-bit (32-byte) secret
    const secret = crypto.getRandomValues(new Uint8Array(32));
    writeFileSync(secretPath, Buffer.from(secret).toString("hex"), {
      mode: 0o600,
    });
    return secret;
  }

  // ── First-Run Detection ───────────────────────────────────

  isFirstRun(): boolean {
    const row = this.db
      .query<{ count: number }, []>("SELECT COUNT(*) as count FROM users")
      .get();
    return (row?.count ?? 0) === 0;
  }

  generateBootstrapToken(): string {
    // Generate 24 random bytes, format as XXXX-XXXX-XXXX-XXXX-XXXX-XXXX
    const bytes = crypto.getRandomValues(new Uint8Array(24));
    const hex = Buffer.from(bytes).toString("hex").toUpperCase();
    const groups = hex.match(/.{1,4}/g) ?? [];
    const formatted = groups.slice(0, 6).join("-");

    this.bootstrapToken = formatted;

    console.log(`
  ╔══════════════════════════════════════════════════════╗
  ║  CODE Mobile - First Run Setup                       ║
  ║  Bootstrap token: ${formatted}    ║
  ║  Use this token in the app to set up your account   ║
  ╚══════════════════════════════════════════════════════╝
`);

    return formatted;
  }

  validateBootstrapToken(token: string): boolean {
    if (!this.bootstrapToken) return false;
    const valid = this.bootstrapToken === token;
    if (valid) {
      // One-time use: clear after successful validation
      this.bootstrapToken = null;
    }
    return valid;
  }

  // ── Password Hashing ──────────────────────────────────────

  async hashPassword(password: string): Promise<string> {
    return Bun.password.hash(password, {
      algorithm: "argon2id",
      memoryCost: 65536,
      timeCost: 2,
    });
  }

  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return Bun.password.verify(password, hash);
  }

  // ── User Management ───────────────────────────────────────

  createUser(
    id: string,
    username: string,
    passwordHash: string,
  ): void {
    this.db.run(
      "INSERT INTO users (id, username, password_hash) VALUES (?, ?, ?)",
      [id, username, passwordHash],
    );
  }

  getUserByUsername(username: string): UserRow | null {
    return (
      this.db
        .query<UserRow, [string]>(
          "SELECT * FROM users WHERE username = ?",
        )
        .get(username) ?? null
    );
  }

  getUserById(id: string): UserRow | null {
    return (
      this.db
        .query<UserRow, [string]>("SELECT * FROM users WHERE id = ?")
        .get(id) ?? null
    );
  }

  /** Single-user system: get the one configured user */
  getFirstUser(): UserRow | null {
    return (
      this.db
        .query<UserRow, []>("SELECT * FROM users LIMIT 1")
        .get() ?? null
    );
  }

  updatePassword(userId: string, passwordHash: string): void {
    this.db.run("UPDATE users SET password_hash = ? WHERE id = ?", [
      passwordHash,
      userId,
    ]);
  }

  setTotpSecret(userId: string, secret: string): void {
    this.db.run("UPDATE users SET totp_secret = ? WHERE id = ?", [
      secret,
      userId,
    ]);
  }

  // ── JWT Token Generation ──────────────────────────────────

  async generateTokens(
    userId: string,
    deviceId: string,
  ): Promise<TokenPair> {
    const expiresIn = 3600; // 1 hour in seconds

    // Access token: 1 hour
    const accessToken = await new SignJWT({
      sub: userId,
      device: deviceId,
      jti: crypto.randomUUID(),
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(this.jwtSecret);

    // Refresh token: 30 days
    const refreshToken = await new SignJWT({
      sub: userId,
      device: deviceId,
      type: "refresh",
      jti: crypto.randomUUID(),
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("30d")
      .sign(this.jwtSecret);

    // Store refresh token hash in DB
    const tokenHash = new Bun.CryptoHasher("sha256")
      .update(refreshToken)
      .digest("hex");
    const tokenId = crypto.randomUUID();
    const expiresAt = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;

    this.db.run(
      "INSERT INTO refresh_tokens (id, user_id, device_id, token_hash, expires_at) VALUES (?, ?, ?, ?, ?)",
      [tokenId, userId, deviceId, tokenHash, expiresAt],
    );

    return { accessToken, refreshToken, expiresIn };
  }

  // ── JWT Verification ──────────────────────────────────────

  async verifyAccessToken(token: string): Promise<DecodedToken> {
    const { payload } = await jwtVerify(token, this.jwtSecret, {
      algorithms: ["HS256"],
    });
    return payload as DecodedToken;
  }

  // ── Refresh Token Management ──────────────────────────────

  async refreshAccessToken(
    refreshToken: string,
  ): Promise<TokenPair> {
    // Verify the JWT signature and expiry
    const { payload } = await jwtVerify(refreshToken, this.jwtSecret, {
      algorithms: ["HS256"],
    });

    const userId = payload.sub;
    const deviceId = payload.device as string | undefined;
    if (!userId || !deviceId) {
      throw new Error("Invalid refresh token payload");
    }

    // Check the token hash exists in DB (not revoked)
    const tokenHash = new Bun.CryptoHasher("sha256")
      .update(refreshToken)
      .digest("hex");

    const row = this.db
      .query<RefreshTokenRow, [string]>(
        "SELECT * FROM refresh_tokens WHERE token_hash = ?",
      )
      .get(tokenHash);

    if (!row) {
      throw new Error("Refresh token has been revoked");
    }

    // Revoke old refresh token
    this.db.run("DELETE FROM refresh_tokens WHERE token_hash = ?", [tokenHash]);

    // Issue new token pair
    return this.generateTokens(userId, deviceId);
  }

  revokeRefreshToken(refreshToken: string): void {
    const tokenHash = new Bun.CryptoHasher("sha256")
      .update(refreshToken)
      .digest("hex");
    this.db.run("DELETE FROM refresh_tokens WHERE token_hash = ?", [tokenHash]);
  }

  revokeAllDeviceTokens(deviceId: string): void {
    this.db.run("DELETE FROM refresh_tokens WHERE device_id = ?", [deviceId]);
  }

  // ── Device Management ─────────────────────────────────────

  createOrUpdateDevice(
    id: string,
    userId: string,
    name: string,
  ): void {
    this.db.run(
      `INSERT INTO devices (id, user_id, name, last_seen)
       VALUES (?, ?, ?, unixepoch())
       ON CONFLICT(id) DO UPDATE SET name = ?, last_seen = unixepoch()`,
      [id, userId, name, name],
    );
  }

  listDevices(
    userId: string,
  ): { id: string; name: string; lastSeen: number }[] {
    return this.db
      .query<
        { id: string; name: string; last_seen: number },
        [string]
      >("SELECT id, name, last_seen FROM devices WHERE user_id = ? ORDER BY last_seen DESC")
      .all(userId)
      .map((d) => ({ id: d.id, name: d.name, lastSeen: d.last_seen }));
  }

  deleteDevice(deviceId: string, userId: string): boolean {
    // Also revoke all refresh tokens for this device
    this.revokeAllDeviceTokens(deviceId);
    const result = this.db.run(
      "DELETE FROM devices WHERE id = ? AND user_id = ?",
      [deviceId, userId],
    );
    return result.changes > 0;
  }

  clearDevicePushToken(deviceId: string): void {
    this.db.run("UPDATE devices SET push_token = NULL WHERE id = ?", [
      deviceId,
    ]);
  }

  // ── Default User (for bootstrap code auth) ───────────────

  /** Ensure a default user exists for code-based auth. Returns the user ID. */
  async ensureDefaultUser(): Promise<string> {
    const existing = this.getFirstUser();
    if (existing) return existing.id;

    const userId = crypto.randomUUID();
    const passwordHash = await this.hashPassword(crypto.randomUUID()); // random unusable password
    this.createUser(userId, "admin", passwordHash);
    return userId;
  }

  // ── Cleanup ───────────────────────────────────────────────

  cleanupExpiredTokens(): void {
    const now = Math.floor(Date.now() / 1000);
    this.db.run("DELETE FROM refresh_tokens WHERE expires_at < ?", [now]);
  }
}
