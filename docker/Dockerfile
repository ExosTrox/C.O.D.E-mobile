# ── Stage 1: Build ──────────────────────────────────────────────
FROM oven/bun:1 AS builder

WORKDIR /app

# Copy workspace root files first (for dependency resolution)
COPY package.json bun.lock ./
COPY tsconfig.base.json ./

# Copy package.json for each workspace package (layer caching)
COPY packages/core/package.json packages/core/
COPY packages/providers/package.json packages/providers/
COPY packages/daemon/package.json packages/daemon/
COPY packages/web/package.json packages/web/

# Install all dependencies (including devDependencies for build)
RUN bun install --frozen-lockfile

# Copy all source files
COPY packages/core/ packages/core/
COPY packages/providers/ packages/providers/
COPY packages/daemon/ packages/daemon/
COPY packages/web/ packages/web/

# Copy TypeScript configs
COPY tsconfig.json ./
COPY packages/core/tsconfig.json packages/core/
COPY packages/providers/tsconfig.json packages/providers/
COPY packages/daemon/tsconfig.json packages/daemon/
COPY packages/web/tsconfig.json packages/web/
COPY packages/web/tsconfig.app.json packages/web/
COPY packages/web/tsconfig.node.json packages/web/
COPY packages/web/vite.config.ts packages/web/
COPY packages/web/index.html packages/web/

# Build PWA frontend (outputs to packages/web/dist/)
RUN bun run build:web

# ── Stage 2: Runtime ────────────────────────────────────────────
FROM oven/bun:1-slim AS runtime

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    tmux \
    git \
    curl \
    ca-certificates \
    python3 \
    python3-pip \
    python3-venv \
    docker.io \
  && rm -rf /var/lib/apt/lists/*

# Install AI CLIs globally
RUN npm install -g @anthropic-ai/claude-code @openai/codex @google/gemini-cli 2>/dev/null || true

# Install aider-chat via pip (for DeepSeek adapter)
RUN python3 -m pip install --break-system-packages aider-chat 2>/dev/null || true

# Create non-root user
RUN useradd -m -s /bin/bash codemobile \
  && mkdir -p /home/codemobile/.codemobile \
  && chown -R codemobile:codemobile /home/codemobile

WORKDIR /app

# Copy built PWA assets
COPY --from=builder /app/packages/web/dist/ packages/web/dist/

# Copy runtime source (Bun runs TypeScript directly)
COPY --from=builder /app/packages/core/ packages/core/
COPY --from=builder /app/packages/providers/ packages/providers/
COPY --from=builder /app/packages/daemon/ packages/daemon/

# Copy workspace root files for module resolution
COPY --from=builder /app/package.json /app/bun.lock ./
COPY --from=builder /app/tsconfig.base.json ./
COPY --from=builder /app/node_modules/ node_modules/
COPY --from=builder /app/packages/core/node_modules/ packages/core/node_modules/
COPY --from=builder /app/packages/providers/node_modules/ packages/providers/node_modules/
COPY --from=builder /app/packages/daemon/node_modules/ packages/daemon/node_modules/
COPY --from=builder /app/packages/web/node_modules/ packages/web/node_modules/

# Set ownership
RUN chown -R codemobile:codemobile /app

USER codemobile

# Default environment
ENV PORT=3000 \
    HOST=0.0.0.0 \
    NODE_ENV=production \
    DATA_DIR=/home/codemobile/.codemobile

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -sf http://localhost:3000/health || exit 1

CMD ["bun", "run", "packages/daemon/src/index.ts"]
