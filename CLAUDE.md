# CODE Mobile — Claude Code Instructions

## Project Overview
CODE Mobile is a Progressive Web App that provides a real terminal experience on any device.
It connects to AI coding agents (Claude Code, GPT Codex, Gemini, DeepSeek, OpenClaw) running on a Hetzner server.

## Monorepo Structure
```
packages/
  core/          → @code-mobile/core      — Shared types, utilities, constants
  daemon/        → @code-mobile/daemon    — Backend daemon (Bun + Hono)
  web/           → @code-mobile/web       — PWA frontend (Vite + React + TS)
  cli/           → @code-mobile/cli       — CLI for daemon management
  providers/     → @code-mobile/providers — AI provider adapters
```

## Tech Stack
- **Runtime**: Bun (package manager + runtime)
- **Backend**: Hono on Bun
- **Frontend**: Vite + React 19 + TypeScript
- **Database**: SQLite (bun:sqlite)
- **Terminal**: xterm.js + tmux
- **Styling**: Tailwind CSS + shadcn/ui (to be added)
- **State**: Zustand + TanStack Query (to be added)

## Key Commands
- `bun run dev` — Run daemon + web in parallel
- `bun run dev:daemon` — Run daemon only (with --watch)
- `bun run dev:web` — Run web frontend only
- `bun run build` — Build all packages
- `bun run lint` — ESLint across all packages
- `bun run test` — Bun test across all packages
- `bun run typecheck` — TypeScript check all packages

## Conventions
- TypeScript strict mode everywhere
- ESLint flat config + Prettier
- Workspace dependencies use `workspace:*` protocol
- Import shared code via `@code-mobile/core`
- All API responses use `ApiResponse<T>` type from core
- WebSocket messages use discriminated unions from core

## Architecture Notes
- Daemon serves both the REST API and the built PWA static files
- Sessions are managed via tmux (PTY multiplexing)
- Real-time terminal output streams over WebSocket
- Auth is JWT + optional TOTP
- Provider system is pluggable — each AI tool is an adapter

## Master Plan
See `CODE_MOBILE_MASTER_PLAN.md` for the full architecture and prompt roadmap.
