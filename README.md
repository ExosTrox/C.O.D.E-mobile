<p align="center">
  <img src="packages/web/public/icons/icon-192.png" width="80" alt="CODE Mobile" />
</p>

<h1 align="center">CODE Mobile</h1>

<p align="center">
  <strong>Your AI-powered terminal, everywhere.</strong><br/>
  A PWA that gives you a real terminal on any device — phone, tablet, or browser — connected to AI coding agents running on your own machine.
</p>

<p align="center">
  <a href="#quick-start">Quick Start</a> &bull;
  <a href="#how-it-works">How It Works</a> &bull;
  <a href="#install-the-app">Install the App</a> &bull;
  <a href="#self-hosting">Self-Hosting</a> &bull;
  <a href="#development">Development</a>
</p>

---

## What Is This?

CODE Mobile lets you control your computer's terminal from your phone. It supports AI coding agents like **Claude Code**, **GPT Codex**, **Gemini CLI**, **DeepSeek**, and plain **bash/zsh** sessions.

Each user pairs their own machine. Your terminal stays yours — no one else can see or access it.

**Key features:**
- Full terminal with xterm.js + WebGL rendering
- Real-time streaming over WebSocket
- AI provider integration (Claude, Codex, Gemini, DeepSeek)
- File upload from phone to your computer
- Multi-user with self-service signup
- Installable as a native-like app (PWA)
- Secure: JWT auth, rate limiting, encrypted API key storage

---

## Quick Start

### For Users (Joining an Existing Server)

If someone shared a CODE Mobile server URL with you:

1. **Open the URL** in Chrome or Safari (e.g. `https://code.example.com`)
2. **Create an account** — tap "Create Account", pick a username and password
3. **Install the app** (optional but recommended — see [Install the App](#install-the-app))
4. **Pair your machine** — go to Settings, copy the pairing command, run it on your computer
5. **Create a session** — pick an AI agent or plain terminal, and start coding from your phone

### For Admins (Setting Up a Server)

See [Self-Hosting](#self-hosting) below.

---

## How It Works

```
  Your Phone                    Server (Hetzner/VPS)              Your Computer
 ┌──────────┐                  ┌──────────────────┐              ┌──────────────┐
 │  PWA App  │ ── HTTPS/WS ──▶│  CODE Mobile     │◀── SSH ─────│  Reverse SSH │
 │ (browser) │                 │  Daemon (Bun)    │   Tunnel     │  Tunnel      │
 └──────────┘                  └──────────────────┘              └──────────────┘
                                      │
                                      ├── JWT Auth
                                      ├── Session Manager (tmux)
                                      ├── SQLite Database
                                      └── AI Provider Adapters
```

1. Your computer establishes a **persistent reverse SSH tunnel** to the server
2. The server runs the **CODE Mobile daemon** — a Bun + Hono app
3. When you open the PWA, it connects via **WebSocket** for real-time terminal output
4. Terminal commands are forwarded through the SSH tunnel to **tmux** on your machine
5. Each user gets their own isolated tunnel and sessions

---

## Install the App

CODE Mobile is a Progressive Web App — install it for a native app experience.

### Android (Chrome)

1. Open the server URL in **Chrome**
2. Tap the **install banner** at the bottom, or tap **Menu (3 dots) → "Install app"**
3. The app appears on your home screen with the CODE Mobile icon
4. Opens fullscreen — no browser bar

### iPhone (Safari)

1. Open the server URL in **Safari**
2. Tap the **Share button** (box with arrow at the bottom)
3. Scroll down and tap **"Add to Home Screen"**
4. Tap **"Add"**
5. Opens as a standalone app

### Desktop (Chrome/Edge)

1. Open the server URL
2. Click the **install icon** in the address bar (or Menu → "Install CODE Mobile")
3. Opens as a desktop app window

---

## Pair Your Machine

After creating an account, you need to pair your computer so CODE Mobile can access your terminal.

### Step 1: Get the Pairing Command

In the app, go to **Settings → Machine** (or create a session — it will prompt you).
You'll see a command like:

```bash
curl -sSL https://code.example.com/pair.sh | bash -s -- \
  --server code.example.com \
  --port 10001 \
  --token abc123def456...
```

### Step 2: Run It on Your Computer

Open a terminal on your **Mac or Linux** machine and paste the command. It will:

1. Generate an SSH key for the tunnel
2. Register your machine with the server
3. Set up a **persistent reverse SSH tunnel** using `autossh`
   - **macOS**: Creates a launchd service (survives reboots)
   - **Linux**: Creates a systemd user service (survives reboots)

### Step 3: Done

Your machine is now connected. Create a session in the app and start using your terminal.

### Requirements

- **macOS** or **Linux** (Windows WSL2 works too)
- `ssh` and `curl` installed (both come pre-installed on macOS/Linux)
- `autossh` — the pairing script will install it via Homebrew (macOS) or apt (Linux)
- **SSH server enabled** on your machine:
  - **macOS**: System Settings → General → Sharing → Remote Login → ON
  - **Linux**: Usually enabled by default (`sudo systemctl enable ssh`)

---

## Supported AI Agents

| Agent | Provider ID | What It Does |
|-------|------------|--------------|
| Claude Code | `claude-code` | Anthropic's coding agent |
| GPT Codex | `openai-codex` | OpenAI's coding CLI |
| Gemini CLI | `gemini-cli` | Google's Gemini terminal |
| DeepSeek | `deepseek` | DeepSeek coding assistant |
| Terminal | `shell` | Plain bash/zsh session |

Each agent needs its own CLI tool installed on your paired machine.
API keys are configured in the app under **Providers** — stored AES-256-GCM encrypted in the database.

---

## Self-Hosting

### Prerequisites

- A **VPS** (Hetzner, DigitalOcean, etc.) with a public IP
- A **domain** pointed to your server (e.g. via Cloudflare)
- **Docker** installed on the server

### 1. Clone and Configure

```bash
git clone https://github.com/your-username/code-mobile.git
cd code-mobile
cp .env.example .env
```

Edit `.env`:

```env
PORT=80
HOST=0.0.0.0
NODE_ENV=production
DATA_DIR=/home/codemobile/.codemobile
CORS_ORIGINS=https://your-domain.com
```

### 2. Deploy with Docker

```bash
cd docker
docker compose up -d
```

This builds the app and starts the daemon on port 80. If using Cloudflare:

- **DNS**: A record → your server IP (orange cloud = proxied)
- **SSL**: Set to **Flexible** (Cloudflare handles HTTPS, origin is HTTP)
- **WebSocket**: Enabled by default in Cloudflare

### 3. Verify

```bash
curl http://localhost/health
```

You should see:

```json
{"success":true,"data":{"status":"ok","version":"0.0.1","uptime":5,"sessions":0,"isSetupComplete":false}}
```

### 4. Create Your Account

Open `https://your-domain.com` in a browser and tap **"Create Account"**. The first user automatically becomes **admin**.

### Admin Tools

From the server (SSH), you can:

```bash
# Generate an access code to share with someone (expires in 5 min)
curl -X POST http://localhost/internal/generate-code

# Reset all data (users, sessions, machines — start fresh)
curl -X POST http://localhost/internal/reset

# View logs
docker compose logs -f

# Rebuild and redeploy
docker compose build --no-cache && docker compose up -d
```

---

## Development

### Prerequisites

- [Bun](https://bun.sh) v1.3+ — runtime and package manager

### Setup

```bash
git clone https://github.com/your-username/code-mobile.git
cd code-mobile
bun install
```

### Commands

| Command | Description |
|---------|-------------|
| `bun run dev` | Start daemon + web dev server in parallel |
| `bun run dev:daemon` | Start daemon only (with hot reload) |
| `bun run dev:web` | Start Vite dev server only |
| `bun run build` | Build the PWA for production |
| `bun run typecheck` | TypeScript type checking |
| `bun run lint` | ESLint across all packages |
| `bun run test` | Run tests |

### Project Structure

```
packages/
  core/        → @code-mobile/core      — Shared types, schemas, constants
  daemon/      → @code-mobile/daemon    — Backend (Bun + Hono + SQLite)
  web/         → @code-mobile/web       — PWA frontend (Vite + React 19)
  providers/   → @code-mobile/providers — AI provider adapters
  cli/         → @code-mobile/cli       — Admin CLI tool
docker/
  Dockerfile        — Multi-stage build
  docker-compose.yml — Production deployment
```

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Bun |
| Backend | Hono |
| Database | SQLite (bun:sqlite) |
| Frontend | React 19 + TypeScript |
| Bundler | Vite |
| Terminal | xterm.js + WebGL |
| Styling | Tailwind CSS v4 |
| State | Zustand + TanStack Query |
| Auth | JWT (HS256) + optional TOTP |
| Encryption | AES-256-GCM (API keys) |
| Passwords | Argon2id |

---

## Security

- All passwords hashed with **Argon2id**
- JWT tokens with **1-hour** access / **30-day** refresh rotation
- API keys encrypted at rest with **AES-256-GCM**
- Rate limiting on auth (10 req/15min) and mutations (60 req/min)
- Security headers (X-Content-Type-Options, X-Frame-Options, CSP-adjacent)
- Path traversal protection on static file serving
- Session ownership enforcement — users can only access their own sessions
- Internal admin endpoints restricted to localhost

---

## License

MIT
