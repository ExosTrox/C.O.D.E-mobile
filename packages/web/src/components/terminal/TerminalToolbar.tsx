// ── TerminalToolbar ─────────────────────────────────────────
// Touch-friendly special keys bar for mobile.

import { useState, useCallback, useRef } from "react";
import { ChevronUp, ChevronDown } from "lucide-react";
import { wsClient } from "../../services/ws";
import { cn } from "../../lib/cn";

interface TerminalToolbarProps {
  sessionId: string;
}

// ── Key definitions ────────────────────────────────────────

interface KeyDef {
  label: string;
  key?: string;      // tmux key name for sendKeys
  input?: string;     // literal text for sendInput
  ctrl?: string;      // ctrl combo: sends C-{letter}
  wide?: boolean;     // wider button
}

const ROW_1: KeyDef[] = [
  { label: "Tab", key: "Tab" },
  { label: "Ctrl", key: "__CTRL__" },
  { label: "Esc", key: "Escape" },
  { label: "\u2191", key: "Up" },
  { label: "\u2193", key: "Down" },
  { label: "\u2190", key: "Left" },
  { label: "\u2192", key: "Right" },
];

const ROW_2: KeyDef[] = [
  { label: "|", input: "|" },
  { label: "~", input: "~" },
  { label: "`", input: "`" },
  { label: "/", input: "/" },
  { label: "-", input: "-" },
  { label: "_", input: "_" },
  { label: "=", input: "=" },
  { label: "+", input: "+" },
  { label: "[", input: "[" },
  { label: "]", input: "]" },
  { label: "{", input: "{" },
  { label: "}", input: "}" },
  { label: "\\", input: "\\" },
  { label: "\"", input: "\"" },
  { label: "'", input: "'" },
];

const ROW_3: KeyDef[] = [
  { label: "C-c", ctrl: "c", wide: true },
  { label: "C-d", ctrl: "d", wide: true },
  { label: "C-z", ctrl: "z", wide: true },
  { label: "C-l", ctrl: "l", wide: true },
  { label: "C-a", ctrl: "a", wide: true },
  { label: "C-e", ctrl: "e", wide: true },
  { label: "C-r", ctrl: "r", wide: true },
];

// ── Component ──────────────────────────────────────────────

export function TerminalToolbar({ sessionId }: TerminalToolbarProps) {
  const [expanded, setExpanded] = useState(false);
  const [ctrlActive, setCtrlActive] = useState(false);
  const ctrlTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sendKey = useCallback(
    (def: KeyDef) => {
      // Haptic feedback
      if (navigator.vibrate) {
        navigator.vibrate(10);
      }

      // Ctrl toggle
      if (def.key === "__CTRL__") {
        setCtrlActive((prev) => !prev);
        // Auto-release after 3s if not used
        if (ctrlTimeoutRef.current) clearTimeout(ctrlTimeoutRef.current);
        ctrlTimeoutRef.current = setTimeout(() => setCtrlActive(false), 3000);
        return;
      }

      // Ctrl combo
      if (def.ctrl) {
        wsClient.sendKeys(sessionId, `C-${def.ctrl}`);
        setCtrlActive(false);
        return;
      }

      // If Ctrl is toggled and this is a regular key
      if (ctrlActive && def.input && def.input.length === 1) {
        wsClient.sendKeys(sessionId, `C-${def.input}`);
        setCtrlActive(false);
        return;
      }

      // Named key (arrow, tab, esc)
      if (def.key) {
        wsClient.sendKeys(sessionId, def.key);
        return;
      }

      // Literal text
      if (def.input) {
        wsClient.sendInput(sessionId, def.input);
      }
    },
    [sessionId, ctrlActive],
  );

  return (
    <div className="terminal-toolbar bg-surface-1/95 backdrop-blur-lg border-t border-border safe-bottom select-none md:hidden">
      {/* Expand/collapse toggle */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-center w-full h-6 text-text-dimmed hover:text-text-muted"
        aria-label={expanded ? "Collapse toolbar" : "Expand toolbar"}
      >
        {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
      </button>

      {/* Row 1: always visible */}
      <KeyRow keys={ROW_1} onPress={sendKey} ctrlActive={ctrlActive} />

      {/* Row 2 & 3: expandable */}
      {expanded && (
        <>
          <KeyRow keys={ROW_2} onPress={sendKey} ctrlActive={false} />
          <KeyRow keys={ROW_3} onPress={sendKey} ctrlActive={false} />
        </>
      )}
    </div>
  );
}

// ── KeyRow ─────────────────────────────────────────────────

function KeyRow({
  keys,
  onPress,
  ctrlActive,
}: {
  keys: KeyDef[];
  onPress: (key: KeyDef) => void;
  ctrlActive: boolean;
}) {
  return (
    <div className="flex gap-1 px-1.5 py-1 overflow-x-auto scrollbar-none">
      {keys.map((def) => (
        <button
          key={def.label}
          onPointerDown={(e) => {
            e.preventDefault();
            onPress(def);
          }}
          className={cn(
            "shrink-0 h-8 rounded-md font-mono text-xs",
            "bg-surface-2 border border-border",
            "active:scale-90 active:bg-surface-3",
            "transition-all duration-75",
            def.wide ? "px-3 min-w-[3rem]" : "px-2 min-w-[2rem]",
            def.key === "__CTRL__" && ctrlActive
              ? "bg-accent/20 border-accent text-accent"
              : "text-text-secondary hover:text-text-primary",
          )}
        >
          {def.key === "__CTRL__" ? "Ctrl" : def.label}
        </button>
      ))}
    </div>
  );
}
