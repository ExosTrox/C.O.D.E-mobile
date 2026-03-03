import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import * as OTPAuth from "otpauth";
import { Hono } from "hono";
import { AppDatabase } from "../../db/index.js";
import { AuthService } from "../auth.service.js";
import { TotpService } from "../totp.service.js";
import { createAuthRoutes } from "../auth.routes.js";

// ── Test helpers ─────────────────────────────────────────────

let dataDir: string;
let database: AppDatabase;
let authService: AuthService;
let totpService: TotpService;
let app: Hono;

function createTestApp() {
  const routes = createAuthRoutes(authService, totpService);
  const testApp = new Hono();
  testApp.route("/api/v1/auth", routes);
  return testApp;
}

function generateTotpCode(secret: string): string {
  const totp = new OTPAuth.TOTP({
    issuer: "CODEMobile",
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secret),
  });
  return totp.generate();
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
    (init.headers as Record<string, string>)["Content-Type"] =
      "application/json";
  }
  const res = await app.request(path, init);
  return {
    status: res.status,
    json: () => res.json() as Promise<Json>,
  };
}

beforeEach(() => {
  dataDir = mkdtempSync(join(tmpdir(), "codemobile-test-"));
  database = new AppDatabase(dataDir);
  database.runMigrations();
  authService = new AuthService(database.db, dataDir);
  totpService = new TotpService();
  app = createTestApp();
});

afterEach(() => {
  database.close();
  rmSync(dataDir, { recursive: true, force: true });
});

// ── Setup Flow Tests ─────────────────────────────────────────

describe("POST /api/v1/auth/setup", () => {
  test("returns 400 if fields are missing", async () => {
    authService.generateBootstrapToken();
    const res = await req("POST", "/api/v1/auth/setup", { bootstrapToken: "x" });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error.code).toBe("VALIDATION_ERROR");
  });

  test("returns 401 with invalid bootstrap token", async () => {
    authService.generateBootstrapToken();
    const res = await req("POST", "/api/v1/auth/setup", {
      bootstrapToken: "WRONG-TOKEN",
      username: "admin",
      password: "testpass123",
    });
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error.code).toBe("INVALID_TOKEN");
  });

  test("returns 400 if password too short", async () => {
    const token = authService.generateBootstrapToken();
    const res = await req("POST", "/api/v1/auth/setup", {
      bootstrapToken: token,
      username: "admin",
      password: "short",
    });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe("VALIDATION_ERROR");
  });

  test("successfully creates user and returns TOTP setup", async () => {
    const token = authService.generateBootstrapToken();
    const res = await req("POST", "/api/v1/auth/setup", {
      bootstrapToken: token,
      username: "admin",
      password: "securepass123",
    });
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.userId).toBeDefined();
    expect(json.data.totp.secret).toBeDefined();
    expect(json.data.totp.uri).toContain("otpauth://totp/");
    expect(json.data.totp.qrCodeDataUrl).toContain("data:image/png;base64,");
  });

  test("returns 409 if setup called twice", async () => {
    const token = authService.generateBootstrapToken();
    await req("POST", "/api/v1/auth/setup", {
      bootstrapToken: token,
      username: "admin",
      password: "securepass123",
    });

    // Second attempt should fail
    const res = await req("POST", "/api/v1/auth/setup", {
      bootstrapToken: "anything",
      username: "admin2",
      password: "securepass123",
    });
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.error.code).toBe("ALREADY_SETUP");
  });
});

// ── TOTP Verification Tests ──────────────────────────────────

describe("POST /api/v1/auth/setup/verify-totp", () => {
  test("returns 400 if fields missing", async () => {
    const res = await req("POST", "/api/v1/auth/setup/verify-totp", {});
    expect(res.status).toBe(400);
  });

  test("returns 401 with invalid TOTP code", async () => {
    // Setup user first
    const token = authService.generateBootstrapToken();
    const setupRes = await req("POST", "/api/v1/auth/setup", {
      bootstrapToken: token,
      username: "admin",
      password: "securepass123",
    });
    const setupJson = await setupRes.json();
    const userId = setupJson.data.userId;

    const res = await req("POST", "/api/v1/auth/setup/verify-totp", {
      userId,
      totpCode: "000000",
    });
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error.code).toBe("INVALID_TOTP");
  });

  test("returns tokens with valid TOTP code", async () => {
    // Setup user
    const token = authService.generateBootstrapToken();
    const setupRes = await req("POST", "/api/v1/auth/setup", {
      bootstrapToken: token,
      username: "admin",
      password: "securepass123",
    });
    const setupJson = await setupRes.json();
    const userId = setupJson.data.userId;
    const totpSecret = setupJson.data.totp.secret;

    // Generate valid TOTP code
    const totpCode = generateTotpCode(totpSecret);

    const res = await req("POST", "/api/v1/auth/setup/verify-totp", {
      userId,
      totpCode,
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.accessToken).toBeDefined();
    expect(json.data.refreshToken).toBeDefined();
    expect(json.data.expiresIn).toBe(3600);
  });
});

// ── Login Tests ──────────────────────────────────────────────

describe("POST /api/v1/auth/login", () => {
  let totpSecret: string;

  async function setupUser() {
    const token = authService.generateBootstrapToken();
    const res = await req("POST", "/api/v1/auth/setup", {
      bootstrapToken: token,
      username: "admin",
      password: "securepass123",
    });
    const json = await res.json();
    totpSecret = json.data.totp.secret;
  }

  test("returns 400 if fields missing", async () => {
    const res = await req("POST", "/api/v1/auth/login", { password: "x" });
    expect(res.status).toBe(400);
  });

  test("returns 401 with wrong password", async () => {
    await setupUser();
    const totpCode = generateTotpCode(totpSecret);
    const res = await req("POST", "/api/v1/auth/login", {
      password: "wrongpassword",
      totpCode,
      deviceName: "Test Device",
    });
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error.code).toBe("INVALID_CREDENTIALS");
  });

  test("returns 401 without TOTP when required", async () => {
    await setupUser();
    const res = await req("POST", "/api/v1/auth/login", {
      password: "securepass123",
      deviceName: "Test Device",
    });
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error.code).toBe("TOTP_REQUIRED");
  });

  test("returns 401 with invalid TOTP", async () => {
    await setupUser();
    const res = await req("POST", "/api/v1/auth/login", {
      password: "securepass123",
      totpCode: "000000",
      deviceName: "Test Device",
    });
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error.code).toBe("INVALID_TOTP");
  });

  test("returns tokens with valid credentials", async () => {
    await setupUser();
    const totpCode = generateTotpCode(totpSecret);
    const res = await req("POST", "/api/v1/auth/login", {
      password: "securepass123",
      totpCode,
      deviceName: "iPhone 15",
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.accessToken).toBeDefined();
    expect(json.data.refreshToken).toBeDefined();
    expect(json.data.expiresIn).toBe(3600);
  });
});

// ── Token Refresh Tests ──────────────────────────────────────

describe("POST /api/v1/auth/refresh", () => {
  async function loginAndGetTokens() {
    const token = authService.generateBootstrapToken();
    const setupRes = await req("POST", "/api/v1/auth/setup", {
      bootstrapToken: token,
      username: "admin",
      password: "securepass123",
    });
    const setupJson = await setupRes.json();
    const totpSecret = setupJson.data.totp.secret;
    const totpCode = generateTotpCode(totpSecret);

    const verifyRes = await req("POST", "/api/v1/auth/setup/verify-totp", {
      userId: setupJson.data.userId,
      totpCode,
    });
    return (await verifyRes.json()).data;
  }

  test("returns 400 if refreshToken missing", async () => {
    const res = await req("POST", "/api/v1/auth/refresh", {});
    expect(res.status).toBe(400);
  });

  test("returns 401 with invalid refresh token", async () => {
    const res = await req("POST", "/api/v1/auth/refresh", {
      refreshToken: "invalid.token.here",
    });
    expect(res.status).toBe(401);
  });

  test("returns new tokens with valid refresh token", async () => {
    const tokens = await loginAndGetTokens();

    const res = await req("POST", "/api/v1/auth/refresh", {
      refreshToken: tokens.refreshToken,
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.accessToken).toBeDefined();
    expect(json.data.refreshToken).toBeDefined();
    // New tokens should be different
    expect(json.data.accessToken).not.toBe(tokens.accessToken);
  });

  test("old refresh token is revoked after use", async () => {
    const tokens = await loginAndGetTokens();

    // Use the refresh token
    await req("POST", "/api/v1/auth/refresh", {
      refreshToken: tokens.refreshToken,
    });

    // Try to reuse the same refresh token — should fail
    const res = await req("POST", "/api/v1/auth/refresh", {
      refreshToken: tokens.refreshToken,
    });
    expect(res.status).toBe(401);
  });
});

// ── Logout Tests ─────────────────────────────────────────────

describe("POST /api/v1/auth/logout", () => {
  test("succeeds even without refresh token", async () => {
    const res = await req("POST", "/api/v1/auth/logout", {});
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
  });
});

// ── Auth Service Unit Tests ──────────────────────────────────

describe("AuthService", () => {
  test("isFirstRun returns true when no users exist", () => {
    expect(authService.isFirstRun()).toBe(true);
  });

  test("isFirstRun returns false after user creation", async () => {
    const hash = await authService.hashPassword("test123");
    authService.createUser("u1", "admin", hash);
    expect(authService.isFirstRun()).toBe(false);
  });

  test("password hash and verify works", async () => {
    const hash = await authService.hashPassword("my-secure-pw");
    expect(await authService.verifyPassword("my-secure-pw", hash)).toBe(true);
    expect(await authService.verifyPassword("wrong-pw", hash)).toBe(false);
  });

  test("JWT generation and verification works", async () => {
    // Create user and device to satisfy FK constraints
    const hash = await authService.hashPassword("test123");
    authService.createUser("user-1", "admin", hash);
    authService.createOrUpdateDevice("device-1", "user-1", "Test Device");

    const tokens = await authService.generateTokens("user-1", "device-1");
    expect(tokens.accessToken).toBeDefined();
    expect(tokens.refreshToken).toBeDefined();
    expect(tokens.expiresIn).toBe(3600);

    const decoded = await authService.verifyAccessToken(tokens.accessToken);
    expect(decoded.sub).toBe("user-1");
    expect(decoded.device).toBe("device-1");
  });

  test("verifyAccessToken rejects tampered token", async () => {
    // Create user and device to satisfy FK constraints
    const hash = await authService.hashPassword("test123");
    authService.createUser("user-1", "admin", hash);
    authService.createOrUpdateDevice("device-1", "user-1", "Test Device");

    const tokens = await authService.generateTokens("user-1", "device-1");
    const tampered = tokens.accessToken + "x";
    expect(authService.verifyAccessToken(tampered)).rejects.toThrow();
  });

  test("bootstrap token is one-time use", () => {
    const token = authService.generateBootstrapToken();
    expect(authService.validateBootstrapToken(token)).toBe(true);
    // Second use should fail
    expect(authService.validateBootstrapToken(token)).toBe(false);
  });
});

// ── TOTP Service Unit Tests ──────────────────────────────────

describe("TotpService", () => {
  test("generateSecret returns valid setup data", async () => {
    const setup = await totpService.generateSecret("testuser");
    expect(setup.secret).toBeDefined();
    expect(setup.secret.length).toBeGreaterThan(0);
    expect(setup.uri).toContain("otpauth://totp/CODEMobile:testuser");
    expect(setup.uri).toContain("issuer=CODEMobile");
    expect(setup.qrCodeDataUrl).toContain("data:image/png;base64,");
  });

  test("verify accepts valid code", async () => {
    const setup = await totpService.generateSecret("testuser");
    const code = generateTotpCode(setup.secret);
    expect(totpService.verify(setup.secret, code)).toBe(true);
  });

  test("verify rejects invalid code", async () => {
    const setup = await totpService.generateSecret("testuser");
    expect(totpService.verify(setup.secret, "000000")).toBe(false);
  });
});
