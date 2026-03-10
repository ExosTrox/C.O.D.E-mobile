// ── TerminalToolbar ─────────────────────────────────────────
// Touch-friendly special keys bar for mobile.

import { useState, useCallback, useRef } from "react";
import { ChevronUp, ChevronDown, Upload } from "lucide-react";
import { toast } from "sonner";
import { wsClient } from "../../services/ws";
import { apiClient } from "../../services/api";
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
  { label: "Tab", key: "Tab", wide: true },
  { label: "Ctrl", key: "__CTRL__", wide: true },
  { label: "Esc", key: "Escape", wide: true },
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
  const [uploading, setUploading] = useState(false);
  const ctrlTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const sendKey = useCallback(
    (def: KeyDef) => {
      // Haptic feedback
      if (navigator.vibrate) {
        navigator.vibrate(8);
      }

      // Ctrl toggle
      if (def.key === "__CTRL__") {
        setCtrlActive((prev) => !prev);
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

  const handleUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const result = await apiClient.uploadFile(file);
      toast.success(`Uploaded ${result.fileName}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Upload failed";
      toast.error(message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }, []);

  return (
    <div className="bg-surface-0 border-t border-border/60 safe-bottom select-none md:hidden">
      {/* Expand/collapse toggle */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-center w-full h-5 text-text-dimmed hover:text-text-muted transition-colors"
        aria-label={expanded ? "Collapse toolbar" : "Expand toolbar"}
      >
        {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
      </button>

      {/* Row 1: always visible — keys + upload button */}
      <div className="flex gap-1 px-2 pb-1.5 overflow-x-auto scrollbar-none">
        {ROW_1.map((def) => (
          <ToolbarKey
            key={def.label}
            def={def}
            ctrlActive={ctrlActive}
            onPress={sendKey}
          />
        ))}

        {/* Upload button */}
        <button
          onPointerDown={(e) => {
            e.preventDefault();
            if (navigator.vibrate) navigator.vibrate(8);
            fileInputRef.current?.click();
          }}
          disabled={uploading}
          className={cn(
            "shrink-0 h-9 px-2.5 min-w-[2.5rem] rounded-lg text-xs font-medium",
            "bg-surface-2/80 border border-border/50",
            "active:scale-95 transition-all duration-75",
            uploading
              ? "text-accent animate-pulse"
              : "text-text-muted hover:text-text-secondary",
          )}
          aria-label="Upload file"
        >
          <Upload className="h-3.5 w-3.5 mx-auto" />
        </button>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleUpload}
        />
      </div>

      {/* Row 2 & 3: expandable */}
      {expanded && (
        <>
          <div className="flex gap-1 px-2 pb-1 overflow-x-auto scrollbar-none">
            {ROW_2.map((def) => (
              <ToolbarKey key={def.label} def={def} ctrlActive={ctrlActive} onPress={sendKey} />
            ))}
          </div>
          <div className="flex gap-1 px-2 pb-1.5 overflow-x-auto scrollbar-none">
            {ROW_3.map((def) => (
              <ToolbarKey key={def.label} def={def} ctrlActive={false} onPress={sendKey} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── ToolbarKey ────────────────────────────────────────────

function ToolbarKey({
  def,
  ctrlActive,
  onPress,
}: {
  def: KeyDef;
  ctrlActive: boolean;
  onPress: (key: KeyDef) => void;
}) {
  const isCtrlToggle = def.key === "__CTRL__";
  const isActive = isCtrlToggle && ctrlActive;

  return (
    <button
      onPointerDown={(e) => {
        e.preventDefault();
        onPress(def);
      }}
      className={cn(
        "shrink-0 h-9 rounded-lg font-mono text-xs font-medium",
        "transition-all duration-75 active:scale-95",
        def.wide ? "px-3 min-w-[2.75rem]" : "px-2 min-w-[2rem]",
        isActive
          ? "bg-accent/20 border border-accent/50 text-accent shadow-sm shadow-accent/10"
          : def.ctrl
            ? "bg-surface-2/60 border border-border/40 text-accent/80 hover:text-accent"
            : "bg-surface-2/80 border border-border/50 text-text-secondary hover:text-text-primary",
      )}
    >
      {isCtrlToggle ? "Ctrl" : def.label}
    </button>
  );
}
