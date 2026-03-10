// ── Settings Page ───────────────────────────────────────────
// Server, Account, Terminal, About sections.

import { useState, useEffect } from "react";
import {
  Server,
  User,
  Terminal,
  Info,
  LogOut,
  Shield,
  Smartphone,
  ExternalLink,
  Github,
  Loader2,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Header } from "../components/layout/Header";
import { Button } from "../components/ui/Button";
import { Select } from "../components/ui/Select";
import { Slider } from "../components/ui/Slider";
import { Input } from "../components/ui/Input";
import { Modal } from "../components/ui/Modal";
import { Badge } from "../components/ui/Badge";
import { Spinner } from "../components/ui/Spinner";
import { useAuth } from "../hooks/use-auth";
import { useAuthStore } from "../stores/auth.store";
import { useTerminalStore, type CursorStyle } from "../stores/terminal.store";
import { apiClient } from "../services/api";
import { cn } from "../lib/cn";

// ── Section wrapper ─────────────────────────────────────────

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 px-1">
        <Icon className="h-4 w-4 text-text-muted" />
        <h3 className="text-xs font-medium text-text-muted uppercase tracking-wider">{title}</h3>
      </div>
      <div className="rounded-xl bg-surface-1 border border-border divide-y divide-border overflow-hidden">
        {children}
      </div>
    </div>
  );
}

function Row({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between px-4 py-3.5 min-h-[52px]">
      <div className="min-w-0 mr-3">
        <div className="text-sm text-text-primary">{label}</div>
        {description && <div className="text-xs text-text-muted mt-0.5">{description}</div>}
      </div>
      {children && <div className="shrink-0">{children}</div>}
    </div>
  );
}

// ── Server status hook ──────────────────────────────────────

function useServerStatus() {
  const serverUrl = useAuthStore((s) => s.serverUrl);
  const [status, setStatus] = useState<"connected" | "disconnected" | "checking">("checking");
  const [latency, setLatency] = useState<number | null>(null);
  const [version, setVersion] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      setStatus("checking");
      const start = performance.now();
      try {
        const res = await fetch(`${serverUrl}/health`, { signal: AbortSignal.timeout(5000) });
        if (cancelled) return;
        const elapsed = Math.round(performance.now() - start);
        if (res.ok) {
          setStatus("connected");
          setLatency(elapsed);
          try {
            const data = await res.json();
            setVersion(data.data?.version ?? data.version ?? null);
          } catch {
            setVersion(null);
          }
        } else {
          setStatus("disconnected");
          setLatency(null);
        }
      } catch {
        if (!cancelled) {
          setStatus("disconnected");
          setLatency(null);
        }
      }
    }

    check();
    const interval = setInterval(check, 30_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [serverUrl]);

  return { serverUrl, status, latency, version };
}

// ── Change Password Modal ───────────────────────────────────

function ChangePasswordModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    setError("");
    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    setLoading(true);
    try {
      await apiClient.changePassword(currentPassword, newPassword);
      toast.success("Password changed successfully");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      onClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to change password";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Change Password">
      <div className="space-y-4">
        <Input
          type="password"
          label="Current Password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          autoFocus
        />
        <Input
          type="password"
          label="New Password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
        />
        <Input
          type="password"
          label="Confirm New Password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          error={error || undefined}
        />
        <div className="flex gap-2 pt-2">
          <Button
            onClick={handleSubmit}
            disabled={!currentPassword || !newPassword || !confirmPassword || loading}
            className="flex-1"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Change Password"}
          </Button>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ── Active Devices Modal ────────────────────────────────────

interface Device {
  id: string;
  name: string;
  lastSeen: number;
}

function ActiveDevicesModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [revoking, setRevoking] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    apiClient
      .listDevices()
      .then(setDevices)
      .catch(() => toast.error("Failed to load devices"))
      .finally(() => setLoading(false));
  }, [open]);

  const handleRevoke = async (deviceId: string) => {
    setRevoking(deviceId);
    try {
      await apiClient.revokeDevice(deviceId);
      setDevices((prev) => prev.filter((d) => d.id !== deviceId));
      toast.success("Device revoked");
    } catch {
      toast.error("Failed to revoke device");
    } finally {
      setRevoking(null);
    }
  };

  const formatTime = (ts: number) => {
    const d = new Date(ts * 1000);
    const now = Date.now();
    const diff = now - d.getTime();
    if (diff < 60_000) return "Just now";
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
    return d.toLocaleDateString();
  };

  return (
    <Modal open={open} onClose={onClose} title="Active Devices">
      <div className="space-y-2">
        {loading ? (
          <div className="flex justify-center py-8">
            <Spinner size="md" className="text-text-muted" />
          </div>
        ) : devices.length === 0 ? (
          <p className="text-sm text-text-muted text-center py-6">No active devices</p>
        ) : (
          devices.map((device) => (
            <div
              key={device.id}
              className="flex items-center justify-between px-3 py-3 rounded-lg bg-surface-2 border border-border"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Smartphone className="h-4 w-4 text-text-muted shrink-0" />
                  <span className="text-sm text-text-primary truncate">{device.name}</span>
                </div>
                <span className="text-xs text-text-muted ml-6">
                  Last seen: {formatTime(device.lastSeen)}
                </span>
              </div>
              <button
                onClick={() => handleRevoke(device.id)}
                disabled={revoking === device.id}
                className="p-2 rounded-lg hover:bg-error/10 text-text-muted hover:text-error transition-colors shrink-0"
              >
                {revoking === device.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
              </button>
            </div>
          ))
        )}
      </div>
    </Modal>
  );
}

// ── Page ───────────────────────────────────────────────────

export function SettingsPage() {
  const { logout } = useAuth();
  const serverUrl = useAuthStore((s) => s.serverUrl);
  const { status, latency, version } = useServerStatus();

  const [showChangePassword, setShowChangePassword] = useState(false);
  const [showDevices, setShowDevices] = useState(false);

  // Terminal settings
  const fontSize = useTerminalStore((s) => s.fontSize);
  const setFontSize = useTerminalStore((s) => s.setFontSize);
  const theme = useTerminalStore((s) => s.theme);
  const setTheme = useTerminalStore((s) => s.setTheme);
  const cursorStyle = useTerminalStore((s) => s.cursorStyle);
  const setCursorStyle = useTerminalStore((s) => s.setCursorStyle);
  const scrollbackLines = useTerminalStore((s) => s.scrollbackLines);
  const setScrollbackLines = useTerminalStore((s) => s.setScrollbackLines);

  const handleDisconnect = () => {
    logout();
    toast.success("Disconnected from server");
  };

  return (
    <>
      <Header title="Settings" />

      <div className="flex-1 overflow-y-auto pb-24">
        <div className="px-4 py-4 space-y-6 max-w-2xl mx-auto">
          {/* ── Server ──────────────────────────────────── */}
          <Section title="Server" icon={Server}>
            <Row label="Server URL" description={serverUrl}>
              <Badge
                variant={status === "connected" ? "success" : status === "checking" ? "muted" : "error"}
                dot
              >
                {status === "connected" ? "Connected" : status === "checking" ? "Checking" : "Offline"}
              </Badge>
            </Row>

            {status === "connected" && latency !== null && (
              <Row label="Latency">
                <span className="text-sm font-mono text-text-secondary">{latency}ms</span>
              </Row>
            )}

            <Row label="Server Version">
              {status === "checking" ? (
                <Spinner size="sm" className="text-text-muted" />
              ) : (
                <span className="text-sm font-mono text-text-secondary">
                  {version ?? "\u2014"}
                </span>
              )}
            </Row>

            <div className="px-4 py-3">
              <Button
                variant="danger"
                size="sm"
                onClick={handleDisconnect}
                className="w-full"
              >
                <LogOut className="h-3.5 w-3.5" />
                Disconnect
              </Button>
            </div>
          </Section>

          {/* ── Account ─────────────────────────────────── */}
          <Section title="Account" icon={User}>
            <Row label="Change Password" description="Update your login password">
              <Button variant="secondary" size="sm" onClick={() => setShowChangePassword(true)}>
                Change
              </Button>
            </Row>

            <Row label="Active Devices" description="Manage sessions">
              <Button variant="secondary" size="sm" onClick={() => setShowDevices(true)}>
                <Smartphone className="h-3.5 w-3.5" />
                View
              </Button>
            </Row>
          </Section>

          {/* ── Terminal ────────────────────────────────── */}
          <Section title="Terminal" icon={Terminal}>
            <div className="px-4 py-3.5">
              <Slider
                label="Font Size"
                displayValue={`${fontSize}px`}
                min={10}
                max={24}
                step={1}
                value={fontSize}
                onChange={(e) => setFontSize(Number(e.target.value))}
              />
            </div>

            <div className="px-4 py-3.5">
              <Select
                label="Theme"
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
                options={[
                  { value: "tokyo-night", label: "Tokyo Night" },
                  { value: "catppuccin", label: "Catppuccin Mocha" },
                  { value: "dracula", label: "Dracula" },
                  { value: "nord", label: "Nord" },
                  { value: "solarized-dark", label: "Solarized Dark" },
                ]}
              />
            </div>

            <div className="px-4 py-3.5">
              <Select
                label="Cursor Style"
                value={cursorStyle}
                onChange={(e) => setCursorStyle(e.target.value as CursorStyle)}
                options={[
                  { value: "block", label: "Block" },
                  { value: "underline", label: "Underline" },
                  { value: "bar", label: "Bar" },
                ]}
              />
            </div>

            <div className="px-4 py-3.5">
              <Slider
                label="Scrollback Lines"
                displayValue={scrollbackLines.toLocaleString()}
                min={1000}
                max={50000}
                step={1000}
                value={scrollbackLines}
                onChange={(e) => setScrollbackLines(Number(e.target.value))}
              />
            </div>
          </Section>

          {/* ── About ───────────────────────────────────── */}
          <Section title="About" icon={Info}>
            <Row label="CODE Mobile" description="AI Coding Agents on Mobile">
              <span className="text-xs font-mono text-text-muted">v0.1.0</span>
            </Row>

            <Row label="Source Code">
              <a
                href="https://github.com/nicholasareed/C.O.D.E-mobile"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-accent hover:underline"
              >
                <Github className="h-3.5 w-3.5" />
                GitHub
                <ExternalLink className="h-3 w-3" />
              </a>
            </Row>
          </Section>
        </div>
      </div>

      {/* Modals */}
      <ChangePasswordModal
        open={showChangePassword}
        onClose={() => setShowChangePassword(false)}
      />
      <ActiveDevicesModal
        open={showDevices}
        onClose={() => setShowDevices(false)}
      />
    </>
  );
}
