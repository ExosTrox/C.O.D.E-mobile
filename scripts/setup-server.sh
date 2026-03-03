#!/bin/bash
# ── CODE Mobile — Hetzner VPS Initial Setup ─────────────────────
# Run once on a fresh Ubuntu 22.04/24.04 VPS as root.
#
# Usage:
#   ssh root@your-server-ip 'bash -s' < scripts/setup-server.sh
#
# Prerequisites:
#   - Fresh Hetzner VPS (CX22 or higher recommended: 2 vCPU, 4 GB RAM)
#   - Ubuntu 22.04 or 24.04 LTS
#
# After running this script:
#   1. Place Cloudflare Origin Certificate:
#      /etc/ssl/cloudflare/cert.pem
#      /etc/ssl/cloudflare/key.pem
#   2. Clone your repo as the codemobile user
#   3. Create .env file from .env.example
#   4. Run: docker compose -f docker/docker-compose.yml up -d
#
# Cloudflare DNS setup:
#   - Add A record: app.yourdomain.com → <this server's IP> (proxied)
#   - SSL/TLS → Full (strict)
#   - Generate Origin Certificate: SSL/TLS → Origin Server → Create Certificate
#   - Enable "Always Use HTTPS" under SSL/TLS → Edge Certificates
#   - Optional: Cloudflare Tunnel (cloudflared) for zero open ports

set -euo pipefail

echo "═══════════════════════════════════════════════════"
echo "  CODE Mobile — Server Setup"
echo "═══════════════════════════════════════════════════"

# ── System updates ──────────────────────────────────────────────
echo "[1/7] Updating system packages..."
apt-get update && apt-get upgrade -y

# ── Install Docker ──────────────────────────────────────────────
echo "[2/7] Installing Docker..."
if ! command -v docker &>/dev/null; then
  curl -fsSL https://get.docker.com | sh
else
  echo "  Docker already installed: $(docker --version)"
fi

# Install Docker Compose plugin (if not bundled)
if ! docker compose version &>/dev/null; then
  apt-get install -y docker-compose-plugin
fi

# Enable Docker on boot
systemctl enable docker
systemctl start docker

# ── Create application user ────────────────────────────────────
echo "[3/7] Creating codemobile user..."
if ! id codemobile &>/dev/null; then
  useradd -m -s /bin/bash codemobile
  usermod -aG docker codemobile
  echo "  User 'codemobile' created and added to docker group."
else
  echo "  User 'codemobile' already exists."
  usermod -aG docker codemobile
fi

# ── Firewall ────────────────────────────────────────────────────
echo "[4/7] Configuring firewall (UFW)..."
apt-get install -y ufw
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp comment "SSH"
ufw allow 80/tcp comment "HTTP (Cloudflare)"
ufw allow 443/tcp comment "HTTPS (Cloudflare)"
ufw --force enable
echo "  UFW enabled: SSH(22), HTTP(80), HTTPS(443)"

# ── Swap space (for smaller VPS instances) ──────────────────────
echo "[5/7] Setting up swap..."
if [ ! -f /swapfile ]; then
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
  echo "  2G swap file created and enabled."
else
  echo "  Swap already configured."
fi

# ── SSL directory for Cloudflare Origin Certificate ─────────────
echo "[6/7] Preparing SSL directory..."
mkdir -p /etc/ssl/cloudflare
chmod 700 /etc/ssl/cloudflare
echo "  Place your Cloudflare Origin Certificate files:"
echo "    /etc/ssl/cloudflare/cert.pem"
echo "    /etc/ssl/cloudflare/key.pem"

# ── Prepare deployment directory ────────────────────────────────
echo "[7/7] Preparing deployment directory..."
su - codemobile -c 'mkdir -p ~/code-mobile'

echo ""
echo "═══════════════════════════════════════════════════"
echo "  Setup complete!"
echo ""
echo "  Next steps:"
echo "  1. Clone your repo:"
echo "     su - codemobile"
echo "     git clone <YOUR_REPO_URL> ~/code-mobile"
echo ""
echo "  2. Create .env file:"
echo "     cp ~/code-mobile/.env.example ~/code-mobile/.env"
echo "     # Edit .env with your domain and settings"
echo ""
echo "  3. Deploy:"
echo "     cd ~/code-mobile"
echo "     docker compose -f docker/docker-compose.yml up -d"
echo ""
echo "  4. Set up Cloudflare:"
echo "     - A record: app.yourdomain.com → $(curl -4 -sf ifconfig.me || echo '<server-ip>')"
echo "     - SSL/TLS: Full (strict)"
echo "     - Generate Origin Certificate → save to /etc/ssl/cloudflare/"
echo "═══════════════════════════════════════════════════"
