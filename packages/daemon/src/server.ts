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
import { BootstrapCodeService } from "./auth/bootstrap-code.service.js";
import { createAuthRoutes } from "./auth/auth.routes.js";
import { createAuthMiddleware } from "./auth/auth.middleware.js";
import { TmuxService } from "./sessions/tmux.service.js";
import type { RemoteSSHConfig } from "./sessions/tmux.service.js";
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
import { createFileRoutes } from "./files/files.routes.js";
import { MachineService } from "./machines/machine.service.js";
import { createMachineRoutes } from "./machines/machine.routes.js";
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
  "/internal/generate-code",
  "/api/v1/notifications/vapid-key",
  "/api/v1/machines/pair",
  "/pair.sh",
  "/assets/",
  "/manifest.json",
  "/sw.js",
];

function isPublicPath(path: string): boolean {
  if (path === "/" || path === "/index.html") return true;
  return PUBLIC_PATHS.some((p) =>
    // Paths ending with "/" are prefix matches; others are exact or must be followed by /
    p.endsWith("/") ? path.startsWith(p) : path === p || path.startsWith(p + "/"),
  );
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
  const bootstrapCodeService = new BootstrapCodeService();

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

  // ── Initialize machine service (multi-user SSH tunnels) ────
  const machineService = new MachineService(database.db);

  // ── Initialize session services ────────────────────────────
  // Legacy single-user SSH config (backward compat for admin)
  const remoteSSH: RemoteSSHConfig | undefined = process.env.REMOTE_SSH_HOST
    ? {
        host: process.env.REMOTE_SSH_HOST ?? "localhost",
        port: parseInt(process.env.REMOTE_SSH_PORT ?? "2222", 10),
        user: process.env.REMOTE_SSH_USER ?? "go",
        identityFile: process.env.REMOTE_SSH_KEY ?? "/root/.ssh/id_ed25519_codemobile",
      }
    : undefined;
  const fallbackTmux = new TmuxService(remoteSSH);
  const sessionManager = new SessionManager(database.db, fallbackTmux, config.dataDir, machineService);

  // Wire services into session manager for provider resolution and analytics
  sessionManager.setServices(providerRegistry, apiKeyService, analyticsService);

  // Reconcile session state with tmux reality
  sessionManager.reconcile().catch((err) => {
    console.error("[SessionManager] Reconciliation failed:", err);
  });

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
    console.error(`  [ERROR] ${requestId}: ${err instanceof Error ? err.message : String(err)}`);

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
  const rateLimitCleanupInterval = setInterval(() => {
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
  app.route("/api/v1/auth", createAuthRoutes(authService, totpService, bootstrapCodeService));

  // Session routes (real implementation)
  app.route("/api/v1/sessions", createSessionRoutes(sessionManager, config.dataDir));

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

  // File upload routes
  app.route("/api/v1/files", createFileRoutes(machineService, remoteSSH));

  // Machine pairing routes
  app.route("/api/v1/machines", createMachineRoutes(machineService));

  // ── Pairing script (public, served as shell script) ────────
  app.get("/pair.sh", (c) => {
    const script = `#!/bin/bash
# CODE Mobile — Machine Pairing Script
# Usage: curl -sSL https://SERVER/pair.sh | bash -s -- --server SERVER --port PORT --token TOKEN

set -e

SERVER=""
SSH_HOST=""
PORT=""
TOKEN=""
SSH_USER="$(whoami)"

while [[ $# -gt 0 ]]; do
  case $1 in
    --server) SERVER="$2"; shift 2;;
    --ssh-host) SSH_HOST="$2"; shift 2;;
    --port) PORT="$2"; shift 2;;
    --token) TOKEN="$2"; shift 2;;
    *) echo "Unknown arg: $1"; exit 1;;
  esac
done

if [[ -z "$SERVER" || -z "$PORT" || -z "$TOKEN" ]]; then
  echo "Usage: bash pair.sh --server SERVER --ssh-host IP --port PORT --token TOKEN"
  exit 1
fi

# SSH_HOST is the direct IP for SSH (bypasses Cloudflare proxy)
if [[ -z "$SSH_HOST" ]]; then
  SSH_HOST="$SERVER"
fi

echo "=== CODE Mobile Machine Pairing ==="
echo "Server: $SERVER"
echo "SSH Host: $SSH_HOST"
echo "Port: $PORT"
echo "User: $SSH_USER"

# 1. Generate SSH key if needed
KEY_DIR="$HOME/.ssh"
KEY_FILE="$KEY_DIR/id_ed25519_codemobile"
mkdir -p "$KEY_DIR" && chmod 700 "$KEY_DIR"

if [[ ! -f "$KEY_FILE" ]]; then
  echo "Generating SSH key..."
  ssh-keygen -t ed25519 -f "$KEY_FILE" -N "" -C "codemobile-pairing"
fi

# 2. Add server's public key to authorized_keys
echo "Fetching server public key..."
SERVER_KEY=$(curl -sSL "https://$SERVER/api/v1/machines/server-key" 2>/dev/null || echo "")
if [[ -n "$SERVER_KEY" ]]; then
  if ! grep -qF "$SERVER_KEY" "$KEY_DIR/authorized_keys" 2>/dev/null; then
    echo "$SERVER_KEY" >> "$KEY_DIR/authorized_keys"
    chmod 600 "$KEY_DIR/authorized_keys"
    echo "Server key added to authorized_keys"
  fi
fi

# 3. Complete pairing via API (send public key so server can authorize tunnel)
echo "Completing pairing..."
PUB_KEY=$(cat "$KEY_FILE.pub")
RESULT=$(curl -sS -X POST "https://$SERVER/api/v1/machines/pair" \\
  -H "Content-Type: application/json" \\
  -d "{\\"token\\": \\"$TOKEN\\", \\"sshUser\\": \\"$SSH_USER\\", \\"publicKey\\": \\"$PUB_KEY\\"}")

if echo "$RESULT" | grep -q '"success":true'; then
  echo "Pairing successful!"
else
  echo "Pairing failed: $RESULT"
  exit 1
fi

# 4. Set up persistent reverse SSH tunnel
echo "Setting up reverse SSH tunnel on port $PORT..."

# Install autossh if not present
if ! command -v autossh &>/dev/null; then
  if command -v brew &>/dev/null; then
    brew install autossh
  elif command -v apt-get &>/dev/null; then
    sudo apt-get install -y autossh
  else
    echo "Please install autossh manually"
    exit 1
  fi
fi

# Create launchd plist (macOS) or systemd service (Linux)
if [[ "$(uname)" == "Darwin" ]]; then
  PLIST="$HOME/Library/LaunchAgents/com.codemobile.tunnel.plist"
  cat > "$PLIST" << PLIST_EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.codemobile.tunnel</string>
  <key>ProgramArguments</key>
  <array>
    <string>$(which autossh)</string>
    <string>-M</string><string>0</string>
    <string>-N</string>
    <string>-o</string><string>ServerAliveInterval=30</string>
    <string>-o</string><string>ServerAliveCountMax=3</string>
    <string>-o</string><string>StrictHostKeyChecking=no</string>
    <string>-R</string><string>$PORT:localhost:22</string>
    <string>-i</string><string>$KEY_FILE</string>
    <string>root@$SSH_HOST</string>
  </array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardErrorPath</key><string>/tmp/codemobile-tunnel.err</string>
  <key>StandardOutPath</key><string>/tmp/codemobile-tunnel.log</string>
</dict>
</plist>
PLIST_EOF
  launchctl bootout gui/$(id -u) "$PLIST" 2>/dev/null || true
  launchctl bootstrap gui/$(id -u) "$PLIST"
  echo "Tunnel started via launchd"
else
  # Linux: use systemd user service
  SERVICE_DIR="$HOME/.config/systemd/user"
  mkdir -p "$SERVICE_DIR"
  cat > "$SERVICE_DIR/codemobile-tunnel.service" << SVC_EOF
[Unit]
Description=CODE Mobile SSH Tunnel
After=network-online.target

[Service]
ExecStart=$(which autossh) -M 0 -N -o ServerAliveInterval=30 -o ServerAliveCountMax=3 -o StrictHostKeyChecking=no -R $PORT:localhost:22 -i $KEY_FILE root@$SSH_HOST
Restart=always
RestartSec=10

[Install]
WantedBy=default.target
SVC_EOF
  systemctl --user daemon-reload
  systemctl --user enable --now codemobile-tunnel.service
  echo "Tunnel started via systemd"
fi

echo ""
echo "=== Pairing Complete ==="
echo "Your machine is now connected to CODE Mobile."
echo "You can access your terminal from https://$SERVER"
`;
    return new Response(script, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
      },
    });
  });

  // ── Internal: Generate bootstrap code (localhost only) ─────
  app.post("/internal/generate-code", async (c) => {
    // Only allow from localhost
    const ip = c.req.header("x-forwarded-for")?.split(",")[0]?.trim()
      ?? c.req.header("x-real-ip")
      ?? "unknown";
    const isLocal = ip === "127.0.0.1" || ip === "::1" || ip === "localhost" || ip === "unknown";

    if (!isLocal && config.nodeEnv === "production") {
      const body: ApiResponse<never> = {
        success: false,
        error: { code: "FORBIDDEN", message: "Only available from localhost" },
      };
      return c.json(body, 403);
    }

    const code = bootstrapCodeService.generate();

    // Ensure default user exists
    await authService.ensureDefaultUser();

    const body: ApiResponse<{ code: string; expiresIn: number }> = {
      success: true,
      data: { code, expiresIn: 300 },
    };
    return c.json(body);
  });

  // ── Internal: Reset all data (localhost only) ───────────────
  app.post("/internal/reset", (c) => {
    const ip = c.req.header("x-forwarded-for")?.split(",")[0]?.trim()
      ?? c.req.header("x-real-ip")
      ?? "unknown";
    const isLocal = ip === "127.0.0.1" || ip === "::1" || ip === "localhost" || ip === "unknown";

    if (!isLocal && config.nodeEnv === "production") {
      const body: ApiResponse<never> = {
        success: false,
        error: { code: "FORBIDDEN", message: "Only available from localhost" },
      };
      return c.json(body, 403);
    }

    database.resetAllData();

    // Re-generate bootstrap token for fresh setup
    authService.generateBootstrapToken();

    const body: ApiResponse<{ message: string }> = {
      success: true,
      data: { message: "All data has been reset. Server is ready for fresh setup." },
    };
    return c.json(body);
  });

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
      // Cache hashed assets forever, but force revalidation for sw.js and index.html
      let cacheControl: string;
      if (reqPath.startsWith("/assets/")) {
        cacheControl = "public, max-age=31536000, immutable";
      } else if (reqPath === "/sw.js" || reqPath.endsWith(".html")) {
        cacheControl = "no-cache, no-store, must-revalidate";
      } else {
        cacheControl = "public, max-age=0, must-revalidate";
      }
      return new Response(file.stream(), {
        headers: {
          "Content-Type": getMimeType(reqPath),
          "Content-Length": String(file.size),
          "Cache-Control": cacheControl,
        },
      });
    }

    // Try default document for directory requests
    if (normalizedPath.endsWith("/")) {
      const indexPath = resolve(filePath, "index.html");
      const indexFile = Bun.file(indexPath);
      if (indexPath.startsWith(resolvedDistPath) && await indexFile.exists()) {
        return new Response(indexFile.stream(), {
          headers: {
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "no-cache, no-store, must-revalidate",
          },
        });
      }
    }

    // SPA fallback: serve index.html for non-API/non-file routes
    const indexHtml = Bun.file(`${resolvedDistPath}/index.html`);
    if (await indexHtml.exists()) {
      return new Response(indexHtml.stream(), {
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-cache, no-store, must-revalidate",
        },
      });
    }

    return c.text("Not Found - web assets not built. Run: bun run build:web", 404);
  });

  // Cleanup function for graceful shutdown
  function cleanup() {
    clearInterval(rateLimitCleanupInterval);
    analyticsService.stopAll();
    sessionManager.stopAll();
    stopKeepalive();
  }

  return { app, sessionManager, cleanup };
}
