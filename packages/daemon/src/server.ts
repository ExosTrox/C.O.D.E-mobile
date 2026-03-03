import { Hono } from "hono";
import { cors } from "hono/cors";
import { requestId } from "hono/request-id";
import { serveStatic } from "hono/bun";
import { HTTPException } from "hono/http-exception";
import type { ApiResponse } from "@code-mobile/core";
import type { Config } from "./config.js";
import type { AppDatabase } from "./db/index.js";
import { AuthService } from "./auth/auth.service.js";
import type { DecodedToken } from "./auth/auth.service.js";
import { TotpService } from "./auth/totp.service.js";
import { createAuthRoutes } from "./auth/auth.routes.js";
import { createAuthMiddleware } from "./auth/auth.middleware.js";
import { TmuxService } from "./sessions/tmux.service.js";
import { SessionManager } from "./sessions/session.manager.js";
import { createSessionRoutes } from "./sessions/session.routes.js";
import { setupSessionWebSocket, stopKeepalive } from "./sessions/session.ws.js";
import { PermissionService } from "./permissions/permissions.service.js";
import { createPermissionRoutes } from "./permissions/permissions.routes.js";
import { createHookRoutes } from "./hooks/hooks.routes.js";
import { AnalyticsService } from "./analytics/analytics.service.js";

// Hono env bindings for typed context
interface AppEnv {
  Variables: {
    requestId: string;
    user: DecodedToken;
  };
}

// Paths that do not require authentication
const PUBLIC_PATHS = [
  "/health",
  "/api/v1/auth/",
  "/api/v1/ws",
  "/internal/hooks/",
  "/assets/",
  "/manifest.json",
  "/sw.js",
];

function isPublicPath(path: string): boolean {
  if (path === "/" || path === "/index.html") return true;
  return PUBLIC_PATHS.some((p) => path.startsWith(p));
}

export interface AppHandle {
  app: Hono<AppEnv>;
  sessionManager: SessionManager;
  cleanup: () => void;
}

export function createApp(config: Config, database: AppDatabase): AppHandle {
  const app = new Hono<AppEnv>();

  // ── Initialize auth services ───────────────────────────────
  const authService = new AuthService(database.db, config.dataDir);
  const totpService = new TotpService();

  // Bootstrap token on first run
  if (authService.isFirstRun()) {
    authService.generateBootstrapToken();
  }

  // ── Initialize permission service ─────────────────────────
  const permissionService = new PermissionService(database.db);

  // ── Initialize analytics service ────────────────────────
  const analyticsService = new AnalyticsService(database.db, new Map());

  // ── Initialize session services ────────────────────────────
  const tmuxService = new TmuxService();
  const sessionManager = new SessionManager(database.db, tmuxService, config.dataDir);

  // Reconcile session state with tmux reality
  void sessionManager.reconcile();

  // ── 1. Request ID ──────────────────────────────────────────
  app.use("*", requestId());

  // ── 2. Logger ──────────────────────────────────────────────
  app.use("*", async (c, next) => {
    const start = performance.now();
    const method = c.req.method;
    const path = c.req.path;

    await next();

    const duration = (performance.now() - start).toFixed(1);
    const status = c.res.status;
    console.log(`  ${method} ${path} ${status} ${duration}ms`);
  });

  // ── 3. CORS ────────────────────────────────────────────────
  app.use(
    "*",
    cors({
      origin: config.corsOrigins,
      credentials: true,
      allowMethods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
      allowHeaders: ["Content-Type", "Authorization"],
      maxAge: 86400,
    }),
  );

  // ── 4. Error handler ──────────────────────────────────────
  app.onError((err, c) => {
    const requestId = c.get("requestId");
    console.error(`  [ERROR] ${requestId}: ${err.message}`);

    if (err instanceof HTTPException) {
      const body: ApiResponse<never> = {
        success: false,
        error: { code: `HTTP_${err.status}`, message: err.message },
      };
      return c.json(body, err.status);
    }

    const body: ApiResponse<never> = {
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Internal server error" },
    };
    return c.json(body, 500);
  });

  // ── 5. Auth middleware (skip public paths) ─────────────────
  const authMiddleware = createAuthMiddleware(authService);
  app.use("/api/*", async (c, next) => {
    if (isPublicPath(c.req.path)) {
      return next();
    }
    return authMiddleware(c, next);
  });

  // ── Routes ─────────────────────────────────────────────────

  // Health check (public)
  app.get("/health", (c) => {
    const body: ApiResponse<{
      status: string;
      version: string;
      uptime: number;
      sessions: number;
    }> = {
      success: true,
      data: {
        status: "ok",
        version: config.version,
        uptime: process.uptime(),
        sessions: database.getSessionCount(),
      },
    };
    return c.json(body);
  });

  // ── Route groups ────────────────────────────────────────────

  // Auth routes
  app.route("/api/v1/auth", createAuthRoutes(authService, totpService));

  // Session routes (real implementation)
  app.route("/api/v1/sessions", createSessionRoutes(sessionManager));

  // Permission routes (mounted under sessions)
  app.route("/api/v1/sessions", createPermissionRoutes(permissionService));

  // Internal hook routes (unauthenticated — localhost only)
  app.route("/internal/hooks", createHookRoutes(permissionService));

  // WebSocket (WS auth handled internally via ?token= param)
  setupSessionWebSocket(app, authService, sessionManager);

  // Provider routes
  app.all("/api/v1/providers/*", (c) => {
    return c.json(
      {
        success: false,
        error: { code: "NOT_IMPLEMENTED", message: "Provider routes coming soon" },
      },
      501,
    );
  });

  // API key routes
  app.all("/api/v1/api-keys/*", (c) => {
    return c.json(
      {
        success: false,
        error: { code: "NOT_IMPLEMENTED", message: "API key routes coming soon" },
      },
      501,
    );
  });

  // ── Static file serving (PWA) ──────────────────────────────
  // Serve built web assets from packages/web/dist/
  const webDistPath = new URL("../../web/dist", import.meta.url).pathname;

  app.use("/*", serveStatic({ root: webDistPath }));

  // SPA fallback: serve index.html for any unmatched route
  app.get("*", serveStatic({ path: `${webDistPath}/index.html` }));

  // Cleanup function for graceful shutdown
  function cleanup() {
    analyticsService.stopAll();
    sessionManager.stopAll();
    stopKeepalive();
  }

  return { app, sessionManager, cleanup };
}
