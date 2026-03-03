# CODE Mobile — Master Architecture & Claude Code Prompt Roadmap

## Vision
A real terminal experience on mobile (iOS/Android) delivered as a **Progressive Web App (PWA)**. Connect to AI coding sessions running on your Hetzner server. Like having your Mac/Linux terminal in your pocket, powered by Claude, GPT, Gemini, DeepSeek, and OpenClaw.

**No app stores. No fees. Just open the URL and install to home screen.**

---

## Architecture Overview

```
┌──────────────────────────────────────────────────┐
│              PWA (Browser / Home Screen)          │
│  ┌───────────┐ ┌──────────┐ ┌────────────────┐   │
│  │ Terminal   │ │ Session  │ │ Provider       │   │
│  │ Emulator   │ │ Manager  │ │ Selector       │   │
│  │ (xterm.js) │ │ UI       │ │ (Claude/GPT/..)│   │
│  └─────┬─────┘ └────┬─────┘ └───────┬────────┘   │
│        └────────────┼───────────────┘             │
│                     │ WebSocket + REST             │
│  Service Worker ────┤ (offline shell, caching)     │
└─────────────────────┼────────────────────────────┘
                      │ HTTPS / WSS
              ┌───────┴────────┐
              │  CLOUDFLARE    │
              │  DNS + Proxy   │
              │  SSL + Cache   │
              │  DDoS protect  │
              └───────┬────────┘
                      │
┌─────────────────────┼───────────────────────────┐
│           HETZNER SERVER (Ubuntu)                │
│                     │                            │
│  ┌──────────────────┴──────────────────────┐     │
│  │         CODE Mobile Daemon (Bun+Hono)   │     │
│  │                                         │     │
│  │  ┌─────────┐ ┌──────┐ ┌─────────────┐  │     │
│  │  │ Auth    │ │ API  │ │ Session     │  │     │
│  │  │ (JWT +  │ │ REST │ │ Manager     │  │     │
│  │  │  TOTP)  │ │ + WS │ │ (tmux+PTY)  │  │     │
│  │  └─────────┘ └──────┘ └──────┬──────┘  │     │
│  │                              │          │     │
│  │  ┌───────────────────────────┴───────┐  │     │
│  │  │        Provider Adapters          │  │     │
│  │  │ ┌───────┐ ┌─────┐ ┌──────────┐   │  │     │
│  │  │ │Claude │ │GPT/ │ │OpenClaw  │   │  │     │
│  │  │ │Code   │ │Codex│ │(Docker)  │   │  │     │
│  │  │ └───────┘ └─────┘ └──────────┘   │  │     │
│  │  │ ┌───────┐ ┌──────────┐           │  │     │
│  │  │ │Gemini │ │DeepSeek  │           │  │     │
│  │  │ │CLI    │ │Coder     │           │  │     │
│  │  │ └───────┘ └──────────┘           │  │     │
│  │  └───────────────────────────────────┘  │     │
│  └─────────────────────────────────────────┘     │
│                                                  │
│  ┌──────────┐  ┌──────────┐  ┌───────────────┐  │
│  │ SQLite   │  │ Docker   │  │ Static PWA    │  │
│  │ (state)  │  │ (sandbox)│  │ files served  │  │
│  │          │  │          │  │ by daemon     │  │
│  └──────────┘  └──────────┘  └───────────────┘  │
└──────────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| **Frontend** | Vite + React + TypeScript | Fast builds, HMR, perfect PWA support via vite-plugin-pwa |
| **Terminal UI** | xterm.js (native in browser) | No WebView wrapper needed — runs directly, full performance |
| **UI Framework** | Tailwind CSS + shadcn/ui | Dark terminal aesthetic, mobile-responsive, lightweight |
| **State** | Zustand + TanStack Query | Lightweight state + smart server data caching |
| **Backend** | Bun + Hono | Fast TypeScript runtime, native WebSocket support |
| **Database** | SQLite (bun:sqlite) | Zero config, embedded, fast |
| **Terminal Mux** | tmux | Session persistence, PTY multiplexing |
| **DNS/SSL/CDN** | Cloudflare (free tier) | Already have it — auto SSL, DDoS protection, caching |
| **Containers** | Docker | Sandboxed execution, OpenClaw isolation |
| **Server** | Hetzner VPS | Cost-effective EU/US |

---

## What You Need

| Item | Purpose | Cost |
|------|---------|------|
| **Claude Max** | Development + Claude API provider | Already have |
| **Hetzner VPS** | CX32 (4 vCPU, 8GB RAM) | ~€15/month |
| **Cloudflare** | DNS + SSL + CDN + proxy | Already have (free tier) |
| **Domain** | Point to Hetzner via Cloudflare | Already have via CF |
| **OpenAI API key** | GPT/Codex provider | Pay-per-use |
| **Google AI API key** | Gemini provider | Pay-per-use |
| **DeepSeek API key** | DeepSeek provider | Pay-per-use |
| **OpenClaw** | Self-hosted on same server | Free (open source) |

**Total additional cost: ~€15/month + API usage. That's it.**

---

## PWA vs Native App — What You Get

| Feature | PWA | Native App |
|---------|-----|------------|
| Install to home screen | Yes (Add to Home Screen) | Yes |
| Full screen (no browser bar) | Yes (display: standalone) | Yes |
| Works offline (app shell) | Yes (Service Worker) | Yes |
| Push notifications (Android) | Yes | Yes |
| Push notifications (iOS) | Yes (since iOS 16.4) | Yes |
| Auto updates | Instant (just deploy) | App Store review wait |
| App Store fees | $0 | $124/year |
| xterm.js performance | Native browser speed | WebView (slower) |
| Cross-platform | 1 codebase, all devices | 2+ codebases |
| Desktop access too | Yes (same URL!) | No (separate app) |

---

## Development Phases & Claude Code Prompts

### PHASE 0: Project Initialization

**Prompt 0.1 — Create the monorepo**
```
Create a new monorepo project called "code-mobile" using Bun workspaces with the following structure:

packages/
├── core/          # Shared types, utilities, constants (TypeScript)
├── daemon/        # Backend daemon (Bun + Hono) — serves API + static PWA files
├── web/           # PWA frontend (Vite + React + TypeScript)
├── cli/           # CLI for daemon management (optional, for admin)
└── providers/     # AI provider adapters (pluggable system)

Requirements:
- Bun as package manager with workspaces configured in root package.json
- TypeScript strict mode in all packages with a shared tsconfig.base.json
- Path aliases: @code-mobile/core, @code-mobile/daemon, @code-mobile/web, @code-mobile/providers
- ESLint flat config + Prettier at root level
- .gitignore covering: node_modules, dist, .turbo, *.db, .env, .env.local
- Root package.json scripts:
  - "dev": runs daemon + web in parallel (use concurrently)
  - "dev:daemon": bun --watch packages/daemon/src/index.ts
  - "dev:web": cd packages/web && bun run dev
  - "build": builds all packages
  - "build:web": cd packages/web && bun run build
  - "lint": eslint across all packages
  - "test": bun test across all packages
  - "typecheck": tsc --noEmit across all packages
- MIT license
- README.md: "# CODE Mobile\nYour AI-powered terminal, everywhere.\n\nA Progressive Web App that gives you a real terminal on any device, connected to AI coding agents like Claude Code, GPT Codex, Gemini, DeepSeek, and OpenClaw."

Initialize git repo and create initial commit with message "Initial monorepo setup".
```

**Prompt 0.2 — Core package: shared types and schemas**
```
In packages/core/, create the shared type system and validation schemas for CODE Mobile.

src/types/session.ts:
- SessionId: branded string type (type SessionId = string & { __brand: 'SessionId' })
- SessionStatus: 'starting' | 'running' | 'stopped' | 'error' | 'suspended'
- Session: { id: SessionId, name: string, providerId: ProviderId, model: string, status: SessionStatus, createdAt: Date, updatedAt: Date, pid: number | null, tmuxSessionName: string, workDir: string }
- SessionCreateOptions: { name?: string, providerId: ProviderId, model?: string, workDir?: string, envVars?: Record<string, string> }
- SessionEvent: discriminated union with types: 'output' | 'status_change' | 'error' | 'permission_request' | 'notification'

src/types/provider.ts:
- ProviderId: 'claude-code' | 'openai-codex' | 'gemini-cli' | 'deepseek' | 'openclaw'
- ProviderConfig: { id: ProviderId, name: string, displayName: string, icon: string, models: Model[], defaultModel: string, requiresApiKey: boolean, installCommand: string, checkCommand: string }
- Model: { id: string, name: string, contextWindow: number, maxOutput: number, costPer1kInput: number, costPer1kOutput: number }

src/types/api.ts:
- ApiResponse<T>: { success: true, data: T } | { success: false, error: { code: string, message: string } }
- WebSocket message types as discriminated unions:
  - ClientMessage: 'subscribe' | 'unsubscribe' | 'input' | 'resize' | 'ping'
  - ServerMessage: 'output' | 'status' | 'error' | 'permission_request' | 'pong'

src/types/auth.ts:
- User: { id: string, username: string, createdAt: Date, totpEnabled: boolean }
- AuthTokens: { accessToken: string, refreshToken: string, expiresIn: number }
- LoginRequest: { password: string, totpCode?: string, deviceName: string }

src/constants.ts:
- API_VERSION = 'v1'
- DEFAULT_PORT = 3000
- WS_PING_INTERVAL = 30000
- PROVIDERS: Record<ProviderId, ProviderConfig> with all provider definitions and their models pre-configured

src/schemas.ts:
- Zod schemas for every type above, exported alongside the TypeScript types
- Use z.infer<typeof schema> pattern to derive types from schemas

src/index.ts — barrel export everything.

Add zod as a dependency. Make sure "bun run typecheck" passes.
```

---

### PHASE 1: Backend Daemon

**Prompt 1.1 — Daemon server with Hono + static file serving**
```
In packages/daemon/, create the CODE Mobile backend daemon using Bun + Hono.

src/index.ts — Main entry:
- Parse CLI flags with parseArgs: --port (default 3000), --host (default 0.0.0.0), --data-dir (default ~/.codemobile)
- Ensure data directory exists
- Initialize SQLite database
- Run migrations
- Initialize SessionManager
- Start Hono HTTP server
- Log startup info: port, data dir, version
- Graceful shutdown on SIGTERM/SIGINT: stop all sessions, close DB, exit

src/server.ts — Hono app:
- Middleware stack (in order):
  1. Request ID (crypto.randomUUID)
  2. Logger (method, path, status, duration)
  3. CORS (allow configurable origins, credentials: true)
  4. Error handler (catch all, return ApiResponse format)
  5. Auth middleware (skip for: /health, /auth/*, /assets/*, /, /index.html, /manifest.json, /sw.js)
- Route groups:
  - GET /health → { status: 'ok', version, uptime, sessions: count }
  - /api/v1/auth/* → auth routes
  - /api/v1/sessions/* → session routes
  - /api/v1/providers/* → provider routes
  - /api/v1/api-keys/* → API key routes
  - /ws → WebSocket upgrade
- Static file serving: serve packages/web/dist/ for all non-API routes (SPA fallback to index.html)

src/db/index.ts — SQLite with bun:sqlite:
- Database file at {dataDir}/codemobile.db
- WAL mode enabled for concurrent reads
- Migration system: numbered SQL files in src/db/migrations/
- Migration 001_initial.sql:
  - users (id TEXT PK, username TEXT UNIQUE, password_hash TEXT, totp_secret TEXT, created_at INTEGER)
  - sessions (id TEXT PK, name TEXT, provider_id TEXT, model TEXT, status TEXT, tmux_name TEXT, work_dir TEXT, pid INTEGER, created_at INTEGER, updated_at INTEGER)
  - devices (id TEXT PK, user_id TEXT FK, name TEXT, last_seen INTEGER, push_token TEXT)
  - api_keys (provider_id TEXT PK, encrypted_key TEXT, created_at INTEGER)
  - analytics (id INTEGER PK AUTOINCREMENT, session_id TEXT FK, event_type TEXT, data TEXT, created_at INTEGER)

src/config.ts:
- Load from env: PORT, HOST, DATA_DIR, CORS_ORIGINS, NODE_ENV
- Validate required settings
- Export typed Config object

Dependencies: hono, @hono/node-ws (or use Bun's native WebSocket), better-sqlite3 or bun:sqlite

Verify: "bun run packages/daemon/src/index.ts" starts and GET /health returns 200.
```

**Prompt 1.2 — Authentication system**
```
In packages/daemon/src/auth/, implement secure authentication:

auth.service.ts:
- First-run detection: check if any user exists in DB
- generateBootstrapToken(): generate a random 32-char token, print to stdout ONCE on first run with clear formatting:
  ╔══════════════════════════════════════════════════════╗
  ║  CODE Mobile - First Run Setup                       ║
  ║  Bootstrap token: XXXX-XXXX-XXXX-XXXX-XXXX-XXXX    ║
  ║  Use this token in the app to set up your account   ║
  ╚══════════════════════════════════════════════════════╝
- hashPassword(password): use Bun.password.hash with argon2id
- verifyPassword(password, hash): use Bun.password.verify
- generateTokens(userId, deviceId): create JWT pair using jose:
  - Access token: 1 hour expiry, contains { sub: userId, device: deviceId }
  - Refresh token: 30 days expiry, stored in DB
  - Sign with HMAC-SHA256, secret from {dataDir}/jwt.secret (auto-generated on first run)
- verifyAccessToken(token): verify and decode JWT
- revokeRefreshToken(token): delete from DB

totp.service.ts:
- generateSecret(username): create TOTP secret, return { secret, uri, qrCodeDataUrl }
  - URI format: otpauth://totp/CODEMobile:{username}?secret={base32}&issuer=CODEMobile
  - Generate QR code as data URL using qrcode package
- verify(secret, code): validate 6-digit TOTP with 1-step window tolerance
- Use the otpauth library

auth.routes.ts (Hono routes under /api/v1/auth):
- POST /setup — body: { bootstrapToken, username, password }
  - Validate bootstrap token
  - Create user with hashed password
  - Return TOTP setup (secret + QR)
  - This endpoint only works once (returns 409 if user exists)
- POST /setup/verify-totp — body: { userId, totpCode }
  - Verify TOTP code to confirm setup
  - Return first JWT pair
- POST /login — body: { password, totpCode, deviceName }
  - Verify password + TOTP
  - Create/update device record
  - Return JWT pair
- POST /refresh — body: { refreshToken }
  - Validate refresh token
  - Issue new access token
- POST /logout — body: { refreshToken }
  - Revoke refresh token
  - Clear device push token
- GET /devices — list authorized devices with last seen
- DELETE /devices/:id — revoke device (invalidate its tokens)

auth.middleware.ts:
- Extract "Bearer <token>" from Authorization header
- Verify JWT, attach user to c.set('user', decodedUser)
- Return 401 with clear error message on failure

Write tests with bun:test covering: setup flow, login, token refresh, expired tokens, invalid TOTP.
```

**Prompt 1.3 — Session Manager with tmux and PTY streaming**
```
In packages/daemon/src/sessions/, implement the terminal session management:

tmux.service.ts — Low-level tmux wrapper:
- All methods use Bun.spawn to execute tmux commands
- createSession(name: string, command: string, args: string[], env: Record<string,string>):
  tmux new-session -d -s {name} -x 120 -y 40 '{command} {args}'
  Set environment variables before spawning
- killSession(name): tmux kill-session -t {name}
- sendKeys(name, keys: string): tmux send-keys -t {name} {keys}
  Handle special keys: 'Enter' → Enter, 'C-c' → C-c, 'C-d' → C-d, etc.
- sendText(name, text: string): tmux send-keys -t {name} -l '{text}'
  Use -l flag for literal text (no key interpretation)
- capturePane(name): tmux capture-pane -t {name} -p -S -1000
  Return last 1000 lines of scrollback
- resizeWindow(name, cols: number, rows: number): tmux resize-window -t {name} -x {cols} -y {rows}
- listSessions(): tmux list-sessions -F '#{session_name}:#{session_activity}'
- pipePaneToFile(name, filePath: string): tmux pipe-pane -t {name} -o 'cat >> {filePath}'
  This captures ALL terminal output to a file for streaming
- Error handling: detect "session not found", "server not running" etc.

session.streamer.ts — Real-time output streaming:
- Class SessionStreamer extends EventEmitter
- constructor(sessionId, outputFilePath):
  - Create output file if not exists
  - Track current byte offset
- start():
  - Use Bun.file(path).stream() or fs.watch + fs.createReadStream
  - On new data: emit 'data' event with { bytes: Uint8Array, offset: number }
  - Debounce: buffer data and emit every 16ms (60fps) for smooth rendering
- getHistory(fromOffset?: number): read from file starting at offset
  - Used for reconnection: client sends last offset, gets missed data
- stop(): clean up watchers/streams

session.manager.ts — High-level orchestration:
- constructor(db, tmuxService):
  - On startup: check DB for sessions marked 'running', verify tmux sessions exist, update status
- async createSession(options: SessionCreateOptions):
  - Generate SessionId (nanoid)
  - Generate tmux session name: cm-{shortId}
  - Get provider adapter from registry
  - Get spawn command from adapter
  - Create output file: {dataDir}/sessions/{id}/output.log
  - Create tmux session with provider command
  - Start pipe-pane to output file
  - Create SessionStreamer
  - Insert into DB with status 'running'
  - Return Session object
- async stopSession(id):
  - Send Ctrl-C, wait 3 seconds
  - If still running, send "exit", wait 2 seconds
  - If still running, kill tmux session
  - Update DB status to 'stopped'
  - Stop streamer
- async sendInput(id, text): forward to tmux sendText
- async sendKeys(id, keys): forward to tmux sendKeys
- async resizeTerminal(id, cols, rows): forward to tmux resizeWindow
- getStreamer(id): return the SessionStreamer for WebSocket subscription
- listSessions(): query DB with status check
- getSession(id): query DB + tmux status

session.routes.ts (Hono under /api/v1/sessions):
- POST / — create session
- GET / — list sessions (query params: status, provider)
- GET /:id — get session details
- DELETE /:id — stop session
- POST /:id/input — { text: string }
- POST /:id/keys — { keys: string } (e.g., "C-c", "Enter")
- POST /:id/resize — { cols: number, rows: number }
- GET /:id/output — query param: ?offset=0, returns buffered output from that offset

session.ws.ts — WebSocket handler:
- On upgrade: verify JWT from ?token= query param
- On connection: send { type: 'connected', sessionCount }
- Client messages:
  - { type: 'subscribe', sessionId } → attach to SessionStreamer, send history
  - { type: 'unsubscribe', sessionId } → detach from streamer
  - { type: 'input', sessionId, text } → forward to session
  - { type: 'keys', sessionId, keys } → forward to session
  - { type: 'resize', sessionId, cols, rows } → resize terminal
  - { type: 'ping' } → reply { type: 'pong', timestamp }
- Server messages:
  - { type: 'output', sessionId, data: base64, offset } → terminal output
  - { type: 'status', sessionId, status } → session status change
  - { type: 'error', message } → error
- Keepalive: send ping every 30s, disconnect if no pong in 10s
- Handle multiple subscriptions per connection

Write integration tests: create session with 'echo hello', verify output streaming works.
```

**Prompt 1.4 — Provider adapter system**
```
In packages/providers/, create the pluggable AI provider adapter system:

src/types.ts:
- interface ProviderAdapter:
  id: ProviderId
  name: string
  isAvailable(): Promise<boolean>  // check if CLI is installed
  getInstallInstructions(): string
  getSpawnCommand(options: SessionCreateOptions, apiKey: string): SpawnConfig
  // SpawnConfig: { command: string, args: string[], env: Record<string, string>, cwd?: string }
  parseAnalytics?(outputPath: string): Promise<TokenAnalytics>
  // TokenAnalytics: { inputTokens, outputTokens, cacheHits, estimatedCost }

src/adapters/claude-code.ts:
- isAvailable(): check "which claude" exit code
- getSpawnCommand(): return {
    command: 'claude',
    args: ['--dangerously-skip-permissions'],  // for headless use
    env: { ANTHROPIC_API_KEY: apiKey, CLAUDE_MODEL: options.model || 'sonnet' }
  }
- Support models: claude-opus-4-5-20251101, claude-sonnet-4-5-20250929, claude-haiku-4-5-20251001
- parseAnalytics: read ~/.claude/projects/*/conversations/*.jsonl, extract token counts

src/adapters/openai-codex.ts:
- isAvailable(): check "which codex"
- getSpawnCommand(): return {
    command: 'codex',
    args: ['--model', options.model || 'gpt-4.1', '--full-auto'],
    env: { OPENAI_API_KEY: apiKey }
  }
- Support models: gpt-4.1, o3, o4-mini, o3-mini

src/adapters/gemini-cli.ts:
- isAvailable(): check "which gemini"
- getSpawnCommand(): return {
    command: 'gemini',
    args: [],
    env: { GOOGLE_API_KEY: apiKey, GEMINI_MODEL: options.model || 'gemini-2.5-pro' }
  }
- Support models: gemini-2.5-pro, gemini-2.5-flash

src/adapters/deepseek.ts:
- Use aider as the CLI interface for DeepSeek
- isAvailable(): check "which aider"
- getSpawnCommand(): return {
    command: 'aider',
    args: ['--model', `deepseek/${options.model || 'deepseek-chat'}`],
    env: { DEEPSEEK_API_KEY: apiKey }
  }
- Support models: deepseek-chat, deepseek-coder, deepseek-reasoner

src/adapters/openclaw.ts:
- isAvailable(): check if Docker is available + openclaw image exists
- getSpawnCommand(): return Docker run command:
  {
    command: 'docker',
    args: ['run', '-it', '--rm',
      '--cpus=2', '--memory=2g',  // resource limits
      '-v', `${options.workDir}:/workspace`,
      'openclaw/openclaw:latest'],
    env: { /* pass through model API keys */ }
  }
- Security notes in code comments about isolation

src/registry.ts:
- class ProviderRegistry:
  - private adapters: Map<ProviderId, ProviderAdapter>
  - register(adapter): add to map
  - get(id): return adapter or throw
  - list(): return all adapters
  - async checkAvailability(): return Record<ProviderId, boolean>
- Default export: pre-populated registry with all adapters

src/index.ts — export registry and all types

Write tests: mock Bun.spawn, verify spawn commands for each provider.
```

**Prompt 1.5 — API key management**
```
In packages/daemon/src/apikeys/, implement secure API key storage:

apikey.service.ts:
- Uses AES-256-GCM encryption for keys at rest
- Master key: auto-generated on first run, saved to {dataDir}/master.key with chmod 0600
- encrypt(plaintext: string): returns { ciphertext: base64, iv: base64, tag: base64 }
- decrypt(encrypted): returns plaintext string
- storeKey(providerId, apiKey):
  - Encrypt key
  - Upsert into api_keys table
- getKey(providerId): decrypt and return (or null if not set)
- deleteKey(providerId): delete from table
- listKeys(): return all providers with { providerId, isSet: boolean, lastChars: string (last 4 chars), createdAt }
- validateKey(providerId, apiKey): make a minimal API call to verify the key works:
  - Claude: GET /v1/messages with minimal payload
  - OpenAI: GET /v1/models
  - Google: list models endpoint
  - DeepSeek: similar to OpenAI

apikey.routes.ts (Hono under /api/v1/api-keys):
- GET / — list all provider keys (masked)
- PUT /:providerId — { key: string } → store/update key
- DELETE /:providerId — remove key
- POST /:providerId/validate — { key: string } → test and return { valid: boolean, error?: string }

Security:
- Keys NEVER appear in: logs, error messages, API responses
- Rate limit the validate endpoint (5 req/min)
- Delete key from memory after use (overwrite string buffer)

provider.routes.ts (Hono under /api/v1/providers):
- GET / — list all providers with:
  { id, name, displayName, models[], isInstalled: boolean, isKeyConfigured: boolean, status: 'ready' | 'needs_key' | 'not_installed' | 'error' }
- GET /:id — full provider detail
- GET /:id/models — list available models for provider
```

---

### PHASE 2: PWA Frontend

**Prompt 2.1 — Vite + React PWA setup**
```
In packages/web/, create the PWA frontend using Vite + React + TypeScript:

1. Initialize with: bun create vite . --template react-ts
2. Install dependencies:
   - vite-plugin-pwa (for PWA support: manifest, service worker, icons)
   - @xterm/xterm @xterm/addon-fit @xterm/addon-webgl @xterm/addon-web-links
   - tailwindcss @tailwindcss/vite (v4 with Vite plugin)
   - zustand (state management)
   - @tanstack/react-query (API data fetching & caching)
   - zod (shared validation with backend)
   - react-router-dom (SPA routing)
   - lucide-react (icons)
   - sonner (toast notifications)
   - framer-motion (subtle animations)
   - class-variance-authority + clsx + tailwind-merge (for component variants)

3. vite.config.ts:
   - PWA plugin config:
     - registerType: 'autoUpdate'
     - manifest: { name: 'CODE Mobile', short_name: 'CODE', theme_color: '#1a1b26', background_color: '#1a1b26', display: 'standalone', orientation: 'any' }
     - icons: 192x192 and 512x512 (generate placeholders for now)
   - Workbox config: precache app shell, network-first for API calls
   - Proxy /api and /ws to localhost:3000 in dev mode

4. Project structure:
   src/
   ├── main.tsx           # Entry point
   ├── App.tsx            # Router setup
   ├── pages/
   │   ├── Terminal.tsx    # Full terminal view
   │   ├── Sessions.tsx    # Session list
   │   ├── Providers.tsx   # Provider management
   │   ├── Settings.tsx    # Settings
   │   ├── Login.tsx       # Auth login
   │   └── Setup.tsx       # First-time setup
   ├── components/
   │   ├── terminal/       # Terminal emulator components
   │   ├── sessions/       # Session UI components
   │   ├── layout/         # Shell, navigation, header
   │   └── ui/             # Base UI components
   ├── hooks/              # Custom React hooks
   ├── services/           # API client, WebSocket client
   ├── stores/             # Zustand stores
   ├── lib/                # Utilities, helpers
   └── styles/
       └── globals.css     # Tailwind directives + terminal custom styles

5. Tailwind config:
   - Dark mode as default (class strategy)
   - Custom colors: terminal-bg: '#1a1b26', terminal-fg: '#a9b1d6', accent: '#7aa2f7' (Tokyo Night)
   - Custom font: JetBrains Mono for terminal, Inter for UI
   - Install fonts: @fontsource/jetbrains-mono @fontsource/inter

6. Create a basic app shell:
   - Mobile-first responsive layout
   - Bottom navigation bar (visible on mobile): Terminal, Sessions, Providers, Settings
   - Side navigation on desktop
   - Route protection: redirect to /login or /setup if not authenticated
   - Dark by default, smooth transitions

Make sure "bun run dev" in packages/web starts Vite and shows the app shell.
```

**Prompt 2.2 — API client, WebSocket service, and stores**
```
In packages/web/src/services/, create the networking layer:

api.ts — REST API client:
- class ApiClient:
  - constructor: baseUrl from localStorage or window.location.origin
  - private getHeaders(): include Authorization: Bearer {token} from auth store
  - private async request<T>(method, path, body?): generic fetch wrapper
    - Auto-add headers
    - Parse response as ApiResponse<T>
    - On 401: try token refresh, retry once, then redirect to /login
    - On network error: update connection store to 'offline'
    - Timeout: 15 seconds with AbortController
  - Auth methods: setup(), verifyTotp(), login(), refresh(), logout()
  - Session methods: createSession(), listSessions(), getSession(), stopSession(), sendInput(), sendKeys(), resizeTerminal()
  - Provider methods: listProviders(), getProvider()
  - API key methods: listApiKeys(), storeApiKey(), deleteApiKey(), validateApiKey()
  - Health: checkHealth()
- Export singleton instance

ws.ts — WebSocket client:
- class WsClient:
  - private ws: WebSocket | null
  - private reconnectAttempts: number
  - private messageQueue: Array (for offline buffering)
  - private listeners: Map<string, Set<callback>>
  - connect(token: string):
    - URL: wss://{host}/ws?token={token} (or ws:// in dev)
    - Set up event handlers: open, close, error, message
    - On open: flush message queue, emit 'connected'
    - On close: schedule reconnect with exponential backoff (1s, 2s, 4s, 8s... max 30s)
    - On message: parse JSON, dispatch to listeners based on type
  - disconnect(): clean close, cancel reconnect timer
  - send(message): queue if disconnected, send if connected
  - subscribe(sessionId): send { type: 'subscribe', sessionId }
  - unsubscribe(sessionId): send { type: 'unsubscribe', sessionId }
  - sendInput(sessionId, text): send { type: 'input', sessionId, text }
  - sendKeys(sessionId, keys): send { type: 'keys', sessionId, keys }
  - sendResize(sessionId, cols, rows): send { type: 'resize', sessionId, cols, rows }
  - on(eventType, callback): add listener
  - off(eventType, callback): remove listener
  - ping(): send ping, track latency
  - Handle visibility change: reconnect on page visible, disconnect after 5min hidden
- Export singleton instance

In packages/web/src/stores/:

auth.store.ts (Zustand):
- State: { isAuthenticated, user, accessToken, refreshToken, serverUrl, isFirstRun }
- Actions: login(tokens), logout(), setServerUrl(url), refreshAccessToken()
- Persist: serverUrl and tokens to localStorage (not sessionStorage — survives tab close)
- On init: check if tokens exist and are not expired

connection.store.ts (Zustand):
- State: { status: 'disconnected' | 'connecting' | 'connected' | 'error', latencyMs, lastConnected }
- Actions: setStatus(), setLatency()
- Subscribe to WsClient events

sessions.store.ts (Zustand):
- State: { activeSessionId: string | null, terminalSizes: Record<string, {cols, rows}> }
- Actions: setActiveSession(), setTerminalSize()

In packages/web/src/hooks/:
- useApi(): return ApiClient instance
- useWs(): return WsClient instance with auto-connect based on auth state
- useSessions(): TanStack Query wrapper for session CRUD
- useProviders(): TanStack Query wrapper for provider list
- useApiKeys(): TanStack Query wrapper for API key management
```

**Prompt 2.3 — Terminal emulator component (the heart of the app)**
```
In packages/web/src/components/terminal/, create the mobile-optimized terminal emulator:

XTerminal.tsx — Main terminal component:
- Props: { sessionId: string, className?: string }
- Uses @xterm/xterm directly in the browser (this is the PWA advantage — no WebView needed!)
- useEffect to initialize:
  1. Create Terminal instance with config:
     {
       cursorBlink: true,
       cursorStyle: 'block',
       fontSize: 14,
       fontFamily: "'JetBrains Mono', monospace",
       theme: {
         background: '#1a1b26',
         foreground: '#a9b1d6',
         cursor: '#c0caf5',
         selectionBackground: '#33467c',
         black: '#15161e', red: '#f7768e', green: '#9ece6a', yellow: '#e0af68',
         blue: '#7aa2f7', magenta: '#bb9af7', cyan: '#7dcfff', white: '#a9b1d6',
         brightBlack: '#414868', brightRed: '#f7768e', brightGreen: '#9ece6a',
         brightYellow: '#e0af68', brightBlue: '#7aa2f7', brightMagenta: '#bb9af7',
         brightCyan: '#7dcfff', brightWhite: '#c0caf5'
       },
       scrollback: 10000,
       allowProposedApi: true,
     }
  2. Load addons: FitAddon, WebglAddon (with Canvas2D fallback), WebLinksAddon
  3. Open terminal in container div ref
  4. Fit terminal to container
  5. Connect to WebSocket: subscribe to sessionId
  6. terminal.onData(data => wsClient.sendInput(sessionId, data))
  7. wsClient.on('output', (msg) => { if msg.sessionId === sessionId, terminal.write(base64decode(msg.data)) })
- useEffect for resize: use ResizeObserver on container, call fitAddon.fit(), then wsClient.sendResize()
- Cleanup: unsubscribe, dispose terminal on unmount
- Handle reconnection: on WS reconnect, request output from last offset to catch up
- Return: <div ref={terminalRef} className="h-full w-full" />

TerminalToolbar.tsx — Touch-friendly special keys bar:
- Appears above the on-screen keyboard on mobile (use CSS env(safe-area-inset-bottom))
- Scrollable horizontal row of key buttons:
  Row 1 (always visible): Tab | Ctrl | Esc | ↑ | ↓ | ← | →
  Row 2 (expandable): | ~ ` / - _ = + [ ] { } \ " '
  Row 3 (Ctrl combos): C-c | C-d | C-z | C-l | C-a | C-e | C-r
- Ctrl key is a toggle (like Shift): tap to activate, next key sends Ctrl+key
- Each button:
  - Touch feedback: scale animation on press
  - navigator.vibrate(10) on tap (haptic feedback on Android)
  - Send appropriate key sequence via wsClient.sendKeys()
- Detect mobile: only show toolbar on touch devices or narrow viewports
- Style: semi-transparent dark background, rounded pill buttons, monospace font

TerminalHeader.tsx — Session info bar:
- Left: provider icon + model badge (e.g., Claude icon + "sonnet")
- Center: session name (tap to rename — inline edit)
- Right: connection dot (green/yellow/red) + overflow menu button
- Overflow menu (dropdown):
  - Copy terminal content (navigator.clipboard.writeText)
  - Clear terminal (terminal.clear())
  - Reconnect
  - Stop session
- Compact: 40px height, doesn't waste terminal space

TerminalPage.tsx — Full terminal page (combines all above):
- Layout: TerminalHeader (top) → XTerminal (flex-1, fills space) → TerminalToolbar (bottom, mobile only)
- Handle browser keyboard:
  - On mobile: when keyboard appears, terminal container shrinks (CSS handles this with dvh units)
  - Use visualViewport API to detect keyboard height
- URL: /terminal/:sessionId
- If sessionId not found: show error + link to sessions list
- Focus management: tap terminal area to focus input

Mobile-specific CSS in globals.css:
- Use 100dvh (dynamic viewport height) to handle mobile keyboard
- -webkit-overflow-scrolling: touch for iOS momentum scroll
- Prevent pull-to-refresh: overscroll-behavior: none
- Prevent text selection outside terminal: user-select: none on toolbar
- Safe area insets for notched phones

Performance is critical. The terminal must feel instant:
- Use WebGL renderer (Canvas2D fallback)
- requestAnimationFrame batching for output
- No unnecessary React re-renders (terminal lives in a ref, not state)
```

**Prompt 2.4 — Sessions list and new session flow**
```
In packages/web/src/pages/ and components/sessions/, create the session management UI:

pages/Sessions.tsx — Sessions list page:
- TanStack Query: useQuery to fetch sessions, auto-refetch every 5 seconds
- If no sessions: empty state with terminal icon animation and "Create your first session" button
- Session list: vertical stack of SessionCard components
- Pull-to-refresh on mobile (touchstart/touchmove gesture → refetch)
- Floating action button (bottom-right): "+" icon to create new session
- Filter chips at top: All | Running | Stopped

components/sessions/SessionCard.tsx:
- Visual card with:
  - Left: provider icon (colored based on provider)
  - Middle: session name (bold), model name (muted), time since creation (relative)
  - Right: status badge (green dot "Running", gray "Stopped", red "Error")
- Tap: navigate to /terminal/{sessionId}
- Swipe left (on mobile): reveal Stop and Delete actions
- Long press / right-click: context menu with Stop, Delete, Copy ID
- Mini preview: last line of terminal output (fetched with session details, truncated to 1 line)
- Subtle entrance animation with framer-motion (staggered fade-in)

components/sessions/NewSessionModal.tsx:
- Triggered by FAB button on Sessions page
- Modal/bottom-sheet style (bottom sheet on mobile, centered modal on desktop)
- Form:
  1. Provider selector: grid of provider icons/names
     - Show status: green check if ready, yellow warning if needs API key, gray if not installed
     - Disabled providers show tooltip explaining what's needed
  2. Model selector: dropdown, populated based on selected provider
     - Default to provider's default model
  3. Session name: text input with auto-generated placeholder (e.g., "session-{random-4-chars}")
  4. Working directory: text input, default "~/projects" (optional)
  5. "Start Session" button:
     - Calls createSession mutation
     - On success: navigate to /terminal/{newSessionId}
     - On error: show toast with error message
     - Loading state: spinning terminal cursor animation
- Keyboard accessible: Enter to submit, Escape to close

hooks/useSessions.ts:
- useSessionsQuery(): TanStack useQuery for GET /api/v1/sessions, with 5s refetch
- useSessionQuery(id): single session
- useCreateSession(): useMutation with optimistic update (add placeholder to list)
- useStopSession(): useMutation
- useDeleteSession(): useMutation with optimistic remove from list
- All mutations invalidate sessions query on success
```

**Prompt 2.5 — Auth flow pages**
```
In packages/web/src/pages/, create the authentication pages:

pages/Connect.tsx — Server connection (first screen if no serverUrl):
- Simple centered card:
  - CODE Mobile logo/text at top
  - "Connect to your server" heading
  - URL input: placeholder "https://your-server.example.com"
  - "Connect" button
  - On submit:
    - Call GET {url}/health
    - If success: save URL to auth store, check if first run (response includes isSetupComplete)
    - If isSetupComplete false → navigate to /setup
    - If isSetupComplete true → navigate to /login
    - If error: show "Could not reach server" message
- For self-hosted: if accessed directly on server domain, skip this step (URL = window.location.origin)

pages/Setup.tsx — First-time setup:
- Step 1: Enter bootstrap token
  - "Enter the token shown in your server's terminal"
  - Text input for the token
  - "Next" button → validates with POST /auth/setup
- Step 2: Create account
  - Username (pre-filled with "admin", editable)
  - Password + confirmation
  - Password strength indicator
  - "Next" → creates account, receives TOTP setup
- Step 3: Set up 2FA
  - Show QR code (from TOTP setup response, rendered as <img src={qrDataUrl}>)
  - "Scan with your authenticator app (Google Authenticator, Authy, etc.)"
  - 6-digit code input to verify
  - "Complete Setup" → verifies TOTP, receives JWT, navigates to /sessions
- Progress indicator at top showing steps 1-2-3
- All in a centered card, mobile friendly

pages/Login.tsx — Returning user:
- Centered card with CODE Mobile branding
- Password input
- TOTP code input (6 digit, auto-advance on 6 chars)
- "Remember this device" checkbox
- "Sign In" button
- On success: save tokens, connect WebSocket, navigate to /sessions
- On error: shake animation, clear TOTP input, show message
- If device was remembered: auto-fill and attempt login on page load (if refresh token valid)
- Link at bottom: "Connect to a different server" → navigate to /connect

Layout routing (in App.tsx):
- / → redirect to /sessions if authenticated, /connect if not
- /connect → Connect page
- /setup → Setup page (only if server needs setup)
- /login → Login page
- /sessions → Sessions list (protected)
- /terminal/:id → Terminal (protected)
- /providers → Provider management (protected)
- /settings → Settings (protected)
- Protected routes: redirect to /login if not authenticated
- Navigation: bottom tab bar on mobile with icons for Sessions, Providers, Settings
```

---

### PHASE 3: Provider Integrations

**Prompt 3.1 — Claude Code deep integration**
```
Enhance the Claude Code provider adapter for deep integration:

In packages/providers/src/adapters/claude-code.ts, add:

1. Hook System:
   - When creating a Claude Code session, also set up hook scripts in {dataDir}/hooks/
   - PreToolUse hook (bash script):
     - Receives tool name and input as JSON on stdin
     - Sends POST to daemon at /internal/hooks/pre-tool-use with session ID
     - Daemon evaluates permission policy
     - Returns: empty (allow), "block" (deny), or sends push notification and waits for user response
   - PostToolUse hook:
     - Logs tool usage to analytics table
   - Notification hook:
     - Forwards to daemon's notification system → WebSocket → client toast
   - Stop hook:
     - Updates session status in DB
     - Notifies connected clients
   - Configure hooks via environment: CLAUDE_CODE_HOOK_PRE_TOOL_USE={dataDir}/hooks/pre-tool-use.sh

2. Permission Policy Engine (in packages/daemon/src/permissions/):
   - permissions.service.ts:
     - Policies stored in SQLite: { id, sessionId, tool, pathPattern, action: 'allow'|'deny'|'ask' }
     - evaluatePolicy(sessionId, tool, input): check policies, return decision
     - Default policy: 'allow' for Read/Glob/Grep, 'ask' for Edit/Write/Bash
   - permissions.routes.ts:
     - GET /sessions/:id/permissions — list policies
     - PUT /sessions/:id/permissions — update policies
     - POST /sessions/:id/permissions/respond — respond to permission request (from mobile)

3. Analytics Parser (in packages/providers/src/adapters/claude-code-analytics.ts):
   - Watch Claude Code's conversation JSONL file
   - Extract per-message: role, model, input_tokens, output_tokens, cache_creation_input_tokens, cache_read_input_tokens
   - Calculate running totals and cost estimates using model pricing from core/constants
   - Emit analytics events that the daemon can store

4. Session Resume:
   - Store Claude Code's conversation ID (from transcript)
   - On session restart: spawn with --resume and --conversation-id flags
   - This preserves full context across crashes
```

**Prompt 3.2 — OpenClaw integration with Docker isolation**
```
Create the OpenClaw provider adapter with security isolation:

In packages/providers/src/adapters/openclaw.ts:

1. Docker Management:
   - Build a custom Dockerfile for OpenClaw: openclaw.Dockerfile
     - Base: node:20-slim
     - Install OpenClaw from npm/git
     - Create non-root user
     - Set resource limits in compose
   - buildImage(): docker build -t codemobile-openclaw -f openclaw.Dockerfile .
   - isImageBuilt(): docker image inspect codemobile-openclaw

2. Container Lifecycle:
   - getSpawnCommand returns docker run with:
     - --rm (auto-cleanup)
     - --cpus=2 --memory=2g (resource limits)
     - --network=openclaw-net (restricted network: only allow API endpoints for LLM providers)
     - -v {workDir}:/workspace:rw (project files)
     - --read-only --tmpfs /tmp (read-only root filesystem)
     - Environment: pass through API keys for selected model
   - Container naming: cm-openclaw-{sessionId}
   - Force kill container on session stop

3. Messaging Bridge:
   - OpenClaw expects messaging platform interface
   - Create a local HTTP bridge that:
     - Receives OpenClaw's message output
     - Converts to terminal-compatible text output
     - Writes to the session's output pipe
   - Bridge runs as a sidecar process or is embedded in the daemon
   - Translate rich messages (cards, buttons) to ASCII-rendered equivalents

4. Skill Management:
   - GET /api/v1/openclaw/skills — list installed skills
   - POST /api/v1/openclaw/skills/install — { skillUrl } → install inside container
   - DELETE /api/v1/openclaw/skills/:name — remove skill
   - Before installing: basic safety check (scan for known dangerous patterns)

5. Docker network setup (in deployment config):
   - Create restricted network: docker network create --internal openclaw-net
   - Add iptables rules to only allow outbound to: api.anthropic.com, api.openai.com, api.deepseek.com
```

**Prompt 3.3 — Remaining providers: GPT Codex, Gemini, DeepSeek**
```
Implement and test the remaining provider adapters:

1. packages/providers/src/adapters/openai-codex.ts — COMPLETE IMPLEMENTATION:
   - isAvailable(): check 'which codex' via Bun.spawn
   - getInstallInstructions(): 'npm install -g @openai/codex'
   - getSpawnCommand():
     command: 'codex'
     args: ['--model', model, '--full-auto', '--quiet']
     env: { OPENAI_API_KEY: apiKey }
   - Models: gpt-4.1, o3, o4-mini, o3-mini
   - parseAnalytics: parse codex output for usage stats if available

2. packages/providers/src/adapters/gemini-cli.ts — COMPLETE IMPLEMENTATION:
   - isAvailable(): check 'which gemini'
   - getInstallInstructions(): 'npm install -g @anthropic-ai/gemini-cli' or appropriate package
   - getSpawnCommand():
     command: 'gemini'
     args: ['-m', model]
     env: { GOOGLE_API_KEY: apiKey }
   - Models: gemini-2.5-pro, gemini-2.5-flash
   - Handle Gemini's specific output format in streaming

3. packages/providers/src/adapters/deepseek.ts — COMPLETE IMPLEMENTATION:
   - Uses aider as CLI wrapper
   - isAvailable(): check 'which aider'
   - getInstallInstructions(): 'pip install aider-chat'
   - getSpawnCommand():
     command: 'aider'
     args: ['--model', `deepseek/${model}`, '--no-auto-commits', '--no-git']
     env: { DEEPSEEK_API_KEY: apiKey }
   - Models: deepseek-chat, deepseek-coder, deepseek-reasoner
   - Note: aider supports many models, so this adapter is flexible

4. Update packages/providers/src/registry.ts:
   - Import and register all 5 adapters
   - Export checkAllProviders() that returns status of each

5. Create packages/providers/src/__tests__/adapters.test.ts:
   - Test each adapter's isAvailable (mock Bun.spawn)
   - Test each adapter's getSpawnCommand output
   - Test registry.list() returns all 5
   - Test registry.get() throws for unknown provider
```

---

### PHASE 4: Deploy & Polish

**Prompt 4.1 — Hetzner deployment with Cloudflare**
```
Create the deployment setup for Hetzner server with Cloudflare as DNS/proxy:

1. docker/Dockerfile — Multi-stage build:
   Stage 1 (build):
   - FROM oven/bun:1 AS builder
   - COPY package.json, bun.lockb, packages/*/package.json
   - RUN bun install
   - COPY packages/
   - RUN bun run build:web (build PWA frontend)
   - RUN bun run build (build daemon if needed)

   Stage 2 (runtime):
   - FROM oven/bun:1-slim
   - Install system deps: tmux, git, curl, docker-cli
   - Install AI CLIs: npm install -g @anthropic-ai/claude-code @openai/codex
   - pip install aider-chat
   - COPY --from=builder built packages
   - Create non-root user: codemobile
   - EXPOSE 3000
   - HEALTHCHECK: curl -f http://localhost:3000/health
   - CMD ["bun", "run", "packages/daemon/src/index.ts"]

2. docker/docker-compose.yml:
   services:
     daemon:
       build: .
       ports: ["3000:3000"]
       volumes:
         - codemobile-data:/home/codemobile/.codemobile
         - /var/run/docker.sock:/var/run/docker.sock  # for OpenClaw containers
       environment:
         - PORT=3000
         - NODE_ENV=production
         - DATA_DIR=/home/codemobile/.codemobile
       restart: unless-stopped
       deploy:
         resources:
           limits: { memory: 4G }

   volumes:
     codemobile-data:

   NO Caddy/Nginx — Cloudflare handles SSL termination and proxies to port 3000 directly.

3. Cloudflare configuration guide (as comments in deploy script):
   - Add A record: app.yourdomain.com → Hetzner IP (proxied through Cloudflare)
   - SSL/TLS: Full (strict) — Cloudflare to origin uses Cloudflare Origin Certificate
   - Generate Origin Certificate in CF dashboard, save to server
   - Enable WebSocket support (on by default in CF)
   - Set up Cloudflare Tunnel as alternative (more secure, no exposed ports)
   - Page Rules: cache static assets (*.js, *.css, icons)

4. scripts/setup-server.sh (run once on fresh Hetzner VPS):
   #!/bin/bash
   set -euo pipefail
   # Update system
   apt update && apt upgrade -y
   # Install Docker
   curl -fsSL https://get.docker.com | sh
   # Install Docker Compose plugin
   apt install -y docker-compose-plugin
   # Create user
   useradd -m -s /bin/bash codemobile
   usermod -aG docker codemobile
   # Firewall: only allow SSH + HTTP(S)
   ufw allow 22/tcp
   ufw allow 80/tcp
   ufw allow 443/tcp
   ufw --force enable
   # Swap (for smaller VPS)
   fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
   echo '/swapfile none swap sw 0 0' >> /etc/fstab
   # Install Cloudflare Origin Certificate
   mkdir -p /etc/ssl/cloudflare
   echo "Place your Cloudflare Origin Certificate at /etc/ssl/cloudflare/cert.pem"
   echo "Place your private key at /etc/ssl/cloudflare/key.pem"
   # Clone repo
   su - codemobile -c 'git clone YOUR_REPO_URL ~/code-mobile'
   echo "Setup complete. Run: cd ~/code-mobile && docker compose up -d"

5. scripts/deploy.sh (run for updates):
   #!/bin/bash
   set -euo pipefail
   SERVER=${1:-"your-server-ip"}
   ssh codemobile@$SERVER '
     cd ~/code-mobile &&
     git pull origin main &&
     docker compose build --no-cache &&
     docker compose up -d &&
     sleep 5 &&
     curl -sf http://localhost:3000/health && echo "Deploy OK" || echo "Deploy FAILED"
   '

6. .env.example:
   PORT=3000
   HOST=0.0.0.0
   NODE_ENV=production
   DATA_DIR=/home/codemobile/.codemobile
   CORS_ORIGINS=https://app.yourdomain.com
   # API keys are stored encrypted in the DB, not in env vars
```

**Prompt 4.2 — Provider management and settings UI**
```
Create the provider management and settings pages:

pages/Providers.tsx:
- Grid layout (2 columns on mobile, 3 on desktop) of provider cards
- Each ProviderCard shows:
  - Provider icon (lucide icon or custom SVG)
  - Provider name
  - Status badge:
    - "Ready" (green) — CLI installed + API key configured
    - "Needs API Key" (yellow) — CLI installed but no key
    - "Not Installed" (gray) — CLI not found on server
    - "Error" (red) — issue detected
  - Model count: "3 models available"
- Tap card → open ProviderDetail modal/sheet:
  - Provider name and description
  - Installation status + instructions if not installed
  - API Key section:
    - If set: "API key configured (ends in ...XXXX)" + Remove button
    - If not: masked input + "Save Key" button + "Validate" button
    - Validate shows: spinner → green check or red X with error message
  - Models list: show all available models with context window size
  - Usage stats: total sessions, estimated cost (from analytics)
- Auto-fetch provider status on page load: GET /api/v1/providers

pages/Settings.tsx:
- Sections with clean dividers:
  1. Server:
     - Server URL (display only)
     - Connection status + latency
     - Server version
     - "Disconnect" button → clear stored data, go to /connect
  2. Account:
     - Username (display)
     - "Change Password" button → modal with old/new/confirm
     - "Manage 2FA" → show current TOTP status
     - "Active Devices" → list of devices with revoke buttons
  3. Terminal:
     - Font size slider (10-24px, default 14)
     - Theme selector: Tokyo Night (default), Dracula, Monokai, Solarized Dark, custom
     - Cursor style: block, underline, bar
     - Scrollback lines: 1000, 5000, 10000, unlimited
     - Settings saved to localStorage, applied to terminal component
  4. About:
     - CODE Mobile version
     - "View on GitHub" link
     - Licenses

components/ui/ — Base components needed:
- Button: variants (primary, secondary, ghost, danger), sizes (sm, md, lg)
- Input: text, password (with show/hide toggle), number
- Modal: centered dialog with overlay
- Sheet: bottom sheet for mobile (slides up from bottom)
- Card: container with hover state
- Badge: status indicators
- Toast: using sonner (already installed)
- Select: custom dropdown
- Slider: range input
- Toggle: switch component
- Spinner: loading indicator (terminal cursor blink animation)

All components should be mobile-first, touch-friendly (min 44px tap targets), and follow the dark terminal theme.
```

**Prompt 4.3 — PWA features: offline shell, install prompt, notifications**
```
Complete the PWA features for CODE Mobile:

1. Service Worker (via vite-plugin-pwa workbox config):
   - Precache: all app shell files (HTML, CSS, JS, fonts, icons)
   - Runtime caching strategies:
     - API calls (/api/*): NetworkFirst with 5s timeout, fall back to cache
     - WebSocket: not cacheable, handle in app
     - Static assets: CacheFirst with 30-day expiry
   - Offline fallback: show "Connecting to server..." UI when offline
   - Background sync: queue session commands when offline, replay on reconnect

2. PWA Install Prompt (components/layout/InstallPrompt.tsx):
   - Listen for 'beforeinstallprompt' event
   - Show a non-intrusive banner at bottom:
     "Install CODE Mobile for a better experience"
     [Install] [Dismiss]
   - On install: call prompt.prompt()
   - Track if already installed (display-mode: standalone media query)
   - Only show once per session, remember dismissal in localStorage
   - On iOS (no beforeinstallprompt): show instructions:
     "Tap Share → Add to Home Screen"

3. Push Notifications (using Web Push API):
   - Check browser support: 'Notification' in window && 'serviceWorker' in navigator
   - Request permission flow:
     - components/layout/NotificationPrompt.tsx
     - Show after first session creation: "Enable notifications to get alerts when sessions need attention"
     - [Enable] [Not Now]
   - On grant:
     - Subscribe to push with VAPID public key
     - Send subscription to daemon: POST /api/v1/notifications/subscribe
   - Notification types (handled in service worker):
     - Permission request: "Claude Code wants to edit src/index.ts" → tap opens terminal
     - Session complete: "Session 'my-project' finished" → tap opens session
     - Session error: "Session error: connection lost" → tap opens sessions list
   - Daemon side (packages/daemon/src/notifications/):
     - web-push library for sending push notifications
     - Store subscriptions in DB
     - notification.service.ts: sendPush(userId, { title, body, data, actions })

4. Viewport and mobile optimizations in index.html:
   <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">
   <meta name="apple-mobile-web-app-capable" content="yes">
   <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
   <meta name="theme-color" content="#1a1b26">
   <link rel="apple-touch-icon" href="/icons/icon-192.png">

5. App manifest enhancements (in vite PWA config):
   - shortcuts: [{ name: "New Session", url: "/sessions?new=true", icon: "..." }]
   - categories: ["developer", "productivity"]
   - screenshots for install prompt (mobile + desktop)

6. Icons:
   - Create placeholder SVG icon: terminal prompt symbol ">_" in a rounded square
   - Generate sizes: 72, 96, 128, 144, 152, 192, 384, 512 (use sharp or canvas to generate from SVG)
   - Apple touch icon: 180x180
   - Favicon: 32x32 + 16x16
```

**Prompt 4.4 — Analytics dashboard and cost tracking**
```
Create the analytics and monitoring features:

packages/daemon/src/analytics/:

analytics.service.ts:
- recordEvent(sessionId, type, data): insert into analytics table
- Event types: 'session_start', 'session_stop', 'tokens_used', 'command_sent', 'error'
- getOverview(period: '24h' | '7d' | '30d'):
  - Total sessions created
  - Total active sessions now
  - Total tokens used (input + output)
  - Estimated total cost
  - Most used provider
- getSessionAnalytics(sessionId):
  - Duration, tokens used, commands sent, errors
  - Token timeline (tokens per minute)
- getProviderBreakdown(period):
  - Per provider: session count, token count, cost estimate
- getUsageTrend(period, granularity: 'hour' | 'day'):
  - Array of { timestamp, sessions, tokens, cost }

analytics.routes.ts (under /api/v1/analytics):
- GET /overview?period=7d
- GET /sessions/:id
- GET /providers?period=30d
- GET /usage?period=7d&granularity=day

packages/web/src/pages/Analytics.tsx (add new route + nav item):
- Overview cards at top (grid):
  - Total sessions (with trend arrow ↑↓)
  - Tokens today
  - Estimated cost today
  - Active sessions now
- Provider breakdown: horizontal bar chart showing usage per provider
  - Simple CSS bars, no chart library needed (or use recharts if already available)
- Usage trend: line chart for last 7 days
  - Show tokens and cost on dual y-axis
  - Use a lightweight chart: either pure SVG or recharts
- Cost tracking:
  - Daily/weekly/monthly cost with breakdown by provider and model
  - Cost per session average
  - Set budget alert threshold (stored in settings)
  - When threshold exceeded: push notification + banner in app

Keep the analytics page simple and fast. Mobile-first layout: cards stack vertically, charts are full-width and touch-scrollable.
```

---

## Execution Timeline

```
Week 1:   Prompt 0.1 + 0.2 (monorepo + types)
Week 2:   Prompt 1.1 + 1.2 (daemon + auth)
Week 3:   Prompt 1.3 (session manager — this is the core, take time)
Week 4:   Prompt 1.4 + 1.5 (providers + API keys)
Week 5:   Prompt 2.1 + 2.2 (PWA setup + networking)
Week 6:   Prompt 2.3 (terminal — the heart, test thoroughly on mobile)
Week 7:   Prompt 2.4 + 2.5 (sessions UI + auth pages)
Week 8:   Prompt 3.1 (Claude Code deep integration)
Week 9:   Prompt 3.2 + 3.3 (OpenClaw + other providers)
Week 10:  Prompt 4.1 (deploy to Hetzner + Cloudflare)
Week 11:  Prompt 4.2 + 4.3 (settings + PWA features)
Week 12:  Prompt 4.4 (analytics) + final testing + polish
```

---

## How To Use These Prompts

1. Open Claude Code (terminal) in your project directory
2. Copy the prompt text (everything inside the ``` block)
3. Paste into Claude Code
4. Let Claude Code execute — review the output
5. Test what was built: run dev server, check endpoints, test on mobile
6. If something needs fixing, describe the issue to Claude Code
7. Move to the next prompt

**Pro tip:** After each prompt, run `bun run typecheck && bun run lint` to catch issues early.

---

## Quick Start

```bash
# After Prompt 0.1 creates the repo:
cd code-mobile
bun install

# Development (after backend + frontend are built):
bun run dev          # Runs daemon + Vite dev server

# Build for production:
bun run build        # Builds everything

# Deploy:
./scripts/deploy.sh your-server-ip
```

## Access Your Terminal

```
# Desktop browser:
https://app.yourdomain.com

# Mobile:
1. Open https://app.yourdomain.com in Chrome/Safari
2. Tap "Add to Home Screen"
3. Open the app from your home screen
4. Connect, authenticate, start coding from anywhere!
```
