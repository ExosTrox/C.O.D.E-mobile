# ── OpenClaw Docker Image ──────────────────────────────────────
# Sandboxed execution environment for OpenClaw AI agent.
# Build: docker build -t codemobile-openclaw -f docker/openclaw.Dockerfile .

FROM node:20-slim AS base

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    curl \
    python3 \
    && rm -rf /var/lib/apt/lists/*

# Install OpenClaw (when available — placeholder for now)
# RUN npm install -g openclaw

# Create non-root user
RUN groupadd -r openclaw && useradd -r -g openclaw -m -s /bin/bash openclaw

# Create workspace directory
RUN mkdir -p /workspace && chown openclaw:openclaw /workspace

# Switch to non-root user
USER openclaw
WORKDIR /workspace

# Health check
HEALTHCHECK --interval=30s --timeout=5s \
  CMD pgrep -x node || exit 1

ENTRYPOINT ["/bin/bash"]
