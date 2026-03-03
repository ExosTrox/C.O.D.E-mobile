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
  Wifi,
  WifiOff,
  Github,
} from "lucide-react";
import { toast } from "sonner";
import { Header } from "../components/layout/Header";
import { Button } from "../components/ui/Button";
import { Select } from "../components/ui/Select";
import { Slider } from "../components/ui/Slider";
import { Toggle } from "../components/ui/Toggle";
import { Badge } from "../components/ui/Badge";
import { Spinner } from "../components/ui/Spinner";
import { useAuth } from "../hooks/use-auth";
import { useAuthStore } from "../stores/auth.store";
import { useTerminalStore, type CursorStyle } from "../stores/terminal.store";
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
            setVersion(data.version ?? null);
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

// ── Page ───────────────────────────────────────────────────

export function SettingsPage() {
  const { logout } = useAuth();
  const serverUrl = useAuthStore((s) => s.serverUrl);
  const { status, latency, version } = useServerStatus();

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
                  {version ?? "—"}
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
            <Row label="Username" description="Primary account">
              <span className="text-sm text-text-secondary">admin</span>
            </Row>

            <Row label="Change Password" description="Update your login password">
              <Button variant="secondary" size="sm">
                Change
              </Button>
            </Row>

            <Row label="Two-Factor Auth" description="Add extra security">
              <Button variant="secondary" size="sm">
                <Shield className="h-3.5 w-3.5" />
                Setup
              </Button>
            </Row>

            <Row label="Active Devices" description="Manage sessions">
              <Button variant="secondary" size="sm">
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

            <Row label="Licenses" description="Open source licenses">
              <Button variant="ghost" size="sm">
                View
              </Button>
            </Row>
          </Section>
        </div>
      </div>
    </>
  );
}
