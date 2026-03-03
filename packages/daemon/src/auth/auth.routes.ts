import { Hono } from "hono";
import type { ApiResponse } from "@code-mobile/core";
import type { AuthService, DecodedToken } from "./auth.service.js";
import type { TotpService } from "./totp.service.js";

interface AuthEnv {
  Variables: {
    requestId: string;
    user: DecodedToken;
  };
}

export function createAuthRoutes(
  authService: AuthService,
  totpService: TotpService,
): Hono<AuthEnv> {
  const auth = new Hono<AuthEnv>();

  // ── POST /setup ────────────────────────────────────────────
  // First-run account setup. Only works once.
  auth.post("/setup", async (c) => {
    // Check if user already exists
    if (!authService.isFirstRun()) {
      const body: ApiResponse<never> = {
        success: false,
        error: { code: "ALREADY_SETUP", message: "Account already configured" },
      };
      return c.json(body, 409);
    }

    const { bootstrapToken, username, password } = await c.req.json<{
      bootstrapToken: string;
      username: string;
      password: string;
    }>();

    if (!bootstrapToken || !username || !password) {
      const body: ApiResponse<never> = {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "bootstrapToken, username, and password are required",
        },
      };
      return c.json(body, 400);
    }

    if (password.length < 8) {
      const body: ApiResponse<never> = {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Password must be at least 8 characters",
        },
      };
      return c.json(body, 400);
    }

    // Validate bootstrap token
    if (!authService.validateBootstrapToken(bootstrapToken)) {
      const body: ApiResponse<never> = {
        success: false,
        error: { code: "INVALID_TOKEN", message: "Invalid bootstrap token" },
      };
      return c.json(body, 401);
    }

    // Create user
    const userId = crypto.randomUUID();
    const passwordHash = await authService.hashPassword(password);
    authService.createUser(userId, username, passwordHash);

    // Generate TOTP secret
    const totpSetup = await totpService.generateSecret(username);
    authService.setTotpSecret(userId, totpSetup.secret);

    const body: ApiResponse<{
      userId: string;
      totp: { secret: string; uri: string; qrCodeDataUrl: string };
    }> = {
      success: true,
      data: {
        userId,
        totp: totpSetup,
      },
    };
    return c.json(body, 201);
  });

  // ── POST /setup/verify-totp ───────────────────────────────
  // Confirm TOTP setup with first code, return first JWT pair
  auth.post("/setup/verify-totp", async (c) => {
    const { userId, totpCode } = await c.req.json<{
      userId: string;
      totpCode: string;
    }>();

    if (!userId || !totpCode) {
      const body: ApiResponse<never> = {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "userId and totpCode are required",
        },
      };
      return c.json(body, 400);
    }

    const user = authService.getUserById(userId);
    if (!user?.totp_secret) {
      const body: ApiResponse<never> = {
        success: false,
        error: { code: "NOT_FOUND", message: "User not found or TOTP not set up" },
      };
      return c.json(body, 404);
    }

    if (!totpService.verify(user.totp_secret, totpCode)) {
      const body: ApiResponse<never> = {
        success: false,
        error: { code: "INVALID_TOTP", message: "Invalid TOTP code" },
      };
      return c.json(body, 401);
    }

    // Create initial device
    const deviceId = crypto.randomUUID();
    authService.createOrUpdateDevice(deviceId, userId, "Setup Device");

    // Generate first JWT pair
    const tokens = await authService.generateTokens(userId, deviceId);

    const body: ApiResponse<{
      accessToken: string;
      refreshToken: string;
      expiresIn: number;
    }> = {
      success: true,
      data: tokens,
    };
    return c.json(body);
  });

  // ── POST /login ───────────────────────────────────────────
  auth.post("/login", async (c) => {
    const { password, totpCode, deviceName } = await c.req.json<{
      password: string;
      totpCode?: string;
      deviceName: string;
    }>();

    if (!password || !deviceName) {
      const body: ApiResponse<never> = {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "password and deviceName are required",
        },
      };
      return c.json(body, 400);
    }

    // Single-user system: get the one configured user
    const user = authService.getFirstUser();
    if (!user) {
      const body: ApiResponse<never> = {
        success: false,
        error: { code: "NOT_SETUP", message: "No account configured. Run setup first." },
      };
      return c.json(body, 401);
    }

    // Verify password
    const passwordValid = await authService.verifyPassword(
      password,
      user.password_hash,
    );
    if (!passwordValid) {
      const body: ApiResponse<never> = {
        success: false,
        error: { code: "INVALID_CREDENTIALS", message: "Invalid password" },
      };
      return c.json(body, 401);
    }

    // Verify TOTP if enabled
    if (user.totp_secret) {
      if (!totpCode) {
        const body: ApiResponse<never> = {
          success: false,
          error: { code: "TOTP_REQUIRED", message: "TOTP code is required" },
        };
        return c.json(body, 401);
      }
      if (!totpService.verify(user.totp_secret, totpCode)) {
        const body: ApiResponse<never> = {
          success: false,
          error: { code: "INVALID_TOTP", message: "Invalid TOTP code" },
        };
        return c.json(body, 401);
      }
    }

    // Create/update device
    const deviceId = crypto.randomUUID();
    authService.createOrUpdateDevice(deviceId, user.id, deviceName);

    // Generate tokens
    const tokens = await authService.generateTokens(user.id, deviceId);

    const body: ApiResponse<{
      accessToken: string;
      refreshToken: string;
      expiresIn: number;
    }> = {
      success: true,
      data: tokens,
    };
    return c.json(body);
  });

  // ── POST /refresh ─────────────────────────────────────────
  auth.post("/refresh", async (c) => {
    const { refreshToken } = await c.req.json<{
      refreshToken: string;
    }>();

    if (!refreshToken) {
      const body: ApiResponse<never> = {
        success: false,
        error: { code: "VALIDATION_ERROR", message: "refreshToken is required" },
      };
      return c.json(body, 400);
    }

    try {
      const tokens = await authService.refreshAccessToken(refreshToken);
      const body: ApiResponse<{
        accessToken: string;
        refreshToken: string;
        expiresIn: number;
      }> = {
        success: true,
        data: tokens,
      };
      return c.json(body);
    } catch {
      const body: ApiResponse<never> = {
        success: false,
        error: { code: "INVALID_TOKEN", message: "Invalid or expired refresh token" },
      };
      return c.json(body, 401);
    }
  });

  // ── POST /logout ──────────────────────────────────────────
  auth.post("/logout", async (c) => {
    const { refreshToken } = await c.req.json<{
      refreshToken: string;
    }>();

    if (refreshToken) {
      authService.revokeRefreshToken(refreshToken);
    }

    const body: ApiResponse<{ message: string }> = {
      success: true,
      data: { message: "Logged out successfully" },
    };
    return c.json(body);
  });

  // ── GET /devices ──────────────────────────────────────────
  // This route requires auth (not in PUBLIC_PATHS)
  auth.get("/devices", (c) => {
    const user = c.get("user");
    const devices = authService.listDevices(user.sub);

    const body: ApiResponse<
      { id: string; name: string; lastSeen: number }[]
    > = {
      success: true,
      data: devices,
    };
    return c.json(body);
  });

  // ── DELETE /devices/:id ───────────────────────────────────
  auth.delete("/devices/:id", (c) => {
    const user = c.get("user");
    const deviceId = c.req.param("id");

    const deleted = authService.deleteDevice(deviceId, user.sub);
    if (!deleted) {
      const body: ApiResponse<never> = {
        success: false,
        error: { code: "NOT_FOUND", message: "Device not found" },
      };
      return c.json(body, 404);
    }

    const body: ApiResponse<{ message: string }> = {
      success: true,
      data: { message: "Device revoked" },
    };
    return c.json(body);
  });

  return auth;
}
