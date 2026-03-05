import { Hono } from "hono";
import { cors } from "hono/cors";
import { requestId } from "hono/request-id";
import { HTTPException } from "hono/http-exception";
import { resolve, normalize } from "path";
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
import { createAnalyticsRoutes } from "./analytics/analytics.routes.js";
import { NotificationService } from "./notifications/notification.service.js";
import { createNotificationRoutes } from "./notifications/notification.routes.js";
import { ApiKeyService } from "./apikeys/apikey.service.js";
import { createApiKeyRoutes } from "./apikeys/apikey.routes.js";
import { createDefaultRegistry } from "@code-mobile/providers";
import { createProviderRoutes } from "./providers/provider.routes.js";

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
  "/api/v1/notifications/vapid-key",
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

  // ── Initialize notification service ──────────────────────
  const notificationService = new NotificationService(database.db, config.dataDir);

  // ── Initialize API key service ─────────────────────────
  const apiKeyService = new ApiKeyService(database.db, config.dataDir);

  // ── Initialize provider registry ───────────────────────
  const providerRegistry = createDefaultRegistry();

  // ── Initialize session services ────────────────────────────
  const tmuxService = new TmuxService();
  const sessionManager = new SessionManager(database.db, tmuxService, config.dataDir);

  // Wire services into session manager for provider resolution and analytics
  sessionManager.setServices(providerRegistry, apiKeyService, analyticsService);

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

  // ── 4. Security headers ──────────────────────────────────
  app.use("*", async (c, next) => {
    await next();
    c.header("X-Content-Type-Options", "nosniff");
    c.header("X-Frame-Options", "DENY");
    c.header("Referrer-Policy", "strict-origin-when-cross-origin");
    c.header("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  });

  // ── 5. Error handler ──────────────────────────────────────
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

  // ── 6. Rate limiting ──────────────────────────────────────
  const rateBuckets = new Map<string, { count: number; resetAt: number }>();

  function rateLimit(key: string, maxRequests: number, windowMs: number): boolean {
    const now = Date.now();
    const entry = rateBuckets.get(key);
    if (entry && entry.resetAt > now && entry.count >= maxRequests) {
      return true; // blocked
    }
    if (!entry || entry.resetAt <= now) {
      rateBuckets.set(key, { count: 1, resetAt: now + windowMs });
    } else {
      entry.count++;
    }
    return false;
  }

  // Cleanup stale entries every 5 minutes
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of rateBuckets) {
      if (entry.resetAt <= now) rateBuckets.delete(key);
    }
  }, 5 * 60 * 1000);

  // Auth endpoints: 10 requests per 15 min per IP
  app.use("/api/v1/auth/*", async (c, next) => {
    if (c.req.method === "GET" || c.req.method === "OPTIONS") return next();
    const ip = c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    if (rateLimit(`auth:${ip}`, 10, 15 * 60 * 1000)) {
      const body: ApiResponse<never> = {
        success: false,
        error: { code: "RATE_LIMITED", message: "Too many attempts. Try again later." },
      };
      return c.json(body, 429);
    }
    return next();
  });

  // API mutations: 60 requests per minute per IP
  for (const path of ["/api/v1/sessions", "/api/v1/api-keys"]) {
    app.use(path, async (c, next) => {
      if (c.req.method === "GET" || c.req.method === "OPTIONS") return next();
      const ip = c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
      if (rateLimit(`api:${ip}`, 60, 60 * 1000)) {
        const body: ApiResponse<never> = {
          success: false,
          error: { code: "RATE_LIMITED", message: "Too many requests. Slow down." },
        };
        return c.json(body, 429);
      }
      return next();
    });
  }

  // ── 6. Auth middleware (skip public paths) ─────────────────
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
      isSetupComplete: boolean;
    }> = {
      success: true,
      data: {
        status: "ok",
        version: config.version,
        uptime: process.uptime(),
        sessions: database.getSessionCount(),
        isSetupComplete: !authService.isFirstRun(),
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

  // Analytics routes
  app.route("/api/v1/analytics", createAnalyticsRoutes(analyticsService));

  // Notification routes
  app.route("/api/v1/notifications", createNotificationRoutes(notificationService));

  // WebSocket (WS auth handled internally via ?token= param)
  setupSessionWebSocket(app, authService, sessionManager);

  // Provider routes
  app.route("/api/v1/providers", createProviderRoutes(providerRegistry, apiKeyService));

  // API key routes
  app.route("/api/v1/api-keys", createApiKeyRoutes(apiKeyService));

  // ── Static file serving (PWA) ──────────────────────────────
  // Serve built web assets from packages/web/dist/
  // import.meta.dir = packages/daemon/src/ → ../../web/dist
  const webDistPath = `${import.meta.dir}/../../web/dist`;

  // MIME type map for static assets
  const MIME_TYPES: Record<string, string> = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".mjs": "application/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
    ".ttf": "font/ttf",
    ".webmanifest": "application/manifest+json",
    ".webp": "image/webp",
    ".txt": "text/plain; charset=utf-8",
    ".xml": "application/xml",
  };

  function getMimeType(path: string): string {
    const ext = path.slice(path.lastIndexOf(".")).toLowerCase();
    return MIME_TYPES[ext] ?? "application/octet-stream";
  }

  const resolvedDistPath = resolve(webDistPath);

  app.get("/*", async (c) => {
    const reqPath = c.req.path;

    // Path traversal protection: resolve and verify path stays within dist
    const normalizedPath = normalize(reqPath);
    const filePath = resolve(resolvedDistPath, `.${normalizedPath}`);
    if (!filePath.startsWith(resolvedDistPath)) {
      return c.text("Forbidden", 403);
    }

    // Try serving the exact file
    const file = Bun.file(filePath);
    if (await file.exists() && file.size > 0) {
      return new Response(file.stream(), {
        headers: {
          "Content-Type": getMimeType(reqPath),
          "Content-Length": String(file.size),
          "Cache-Control": reqPath.startsWith("/assets/")
            ? "public, max-age=31536000, immutable"
            : "public, max-age=0, must-revalidate",
        },
      });
    }

    // Try default document for directory requests
    if (normalizedPath.endsWith("/")) {
      const indexPath = resolve(filePath, "index.html");
      const indexFile = Bun.file(indexPath);
      if (indexPath.startsWith(resolvedDistPath) && await indexFile.exists()) {
        return new Response(indexFile.stream(), {
          headers: { "Content-Type": "text/html; charset=utf-8" },
        });
      }
    }

    // SPA fallback: serve index.html for non-API/non-file routes
    const indexHtml = Bun.file(`${resolvedDistPath}/index.html`);
    if (await indexHtml.exists()) {
      return new Response(indexHtml.stream(), {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    return c.text("Not Found - web assets not built. Run: bun run build:web", 404);
  });

  // Cleanup function for graceful shutdown
  function cleanup() {
    analyticsService.stopAll();
    sessionManager.stopAll();
    stopKeepalive();
  }

  return { app, sessionManager, cleanup };
}
