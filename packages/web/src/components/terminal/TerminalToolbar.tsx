// ── TerminalToolbar ─────────────────────────────────────────
// Touch-friendly special keys bar for mobile terminal.
// Compact single-row default, expandable for symbols & ctrl combos.

import { useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronUp, Upload, Keyboard } from "lucide-react";
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
  sublabel?: string;
  key?: string;
  input?: string;
  ctrl?: string;
  type?: "modifier" | "nav" | "ctrl-combo" | "symbol" | "action";
}

// Primary row: essential keys always visible
const PRIMARY_KEYS: KeyDef[] = [
  { label: "Esc", key: "Escape", type: "modifier" },
  { label: "Tab", key: "Tab", type: "modifier" },
  { label: "Ctrl", key: "__CTRL__", type: "modifier" },
  { label: "↑", key: "Up", type: "nav" },
  { label: "↓", key: "Down", type: "nav" },
  { label: "←", key: "Left", type: "nav" },
  { label: "→", key: "Right", type: "nav" },
];

// Ctrl combos
const CTRL_KEYS: KeyDef[] = [
  { label: "C", sublabel: "cancel", ctrl: "c", type: "ctrl-combo" },
  { label: "D", sublabel: "EOF", ctrl: "d", type: "ctrl-combo" },
  { label: "Z", sublabel: "suspend", ctrl: "z", type: "ctrl-combo" },
  { label: "L", sublabel: "clear", ctrl: "l", type: "ctrl-combo" },
  { label: "A", sublabel: "home", ctrl: "a", type: "ctrl-combo" },
  { label: "E", sublabel: "end", ctrl: "e", type: "ctrl-combo" },
  { label: "R", sublabel: "search", ctrl: "r", type: "ctrl-combo" },
  { label: "W", sublabel: "del word", ctrl: "w", type: "ctrl-combo" },
  { label: "U", sublabel: "del line", ctrl: "u", type: "ctrl-combo" },
  { label: "K", sublabel: "kill", ctrl: "k", type: "ctrl-combo" },
];

// Symbols row
const SYMBOL_KEYS: KeyDef[] = [
  { label: "|", input: "|", type: "symbol" },
  { label: "~", input: "~", type: "symbol" },
  { label: "`", input: "`", type: "symbol" },
  { label: "/", input: "/", type: "symbol" },
  { label: "-", input: "-", type: "symbol" },
  { label: "_", input: "_", type: "symbol" },
  { label: "=", input: "=", type: "symbol" },
  { label: "+", input: "+", type: "symbol" },
  { label: "[", input: "[", type: "symbol" },
  { label: "]", input: "]", type: "symbol" },
  { label: "{", input: "{", type: "symbol" },
  { label: "}", input: "}", type: "symbol" },
  { label: "\\", input: "\\", type: "symbol" },
  { label: "\"", input: "\"", type: "symbol" },
  { label: "'", input: "'", type: "symbol" },
  { label: "&", input: "&", type: "symbol" },
  { label: ";", input: ";", type: "symbol" },
  { label: "$", input: "$", type: "symbol" },
  { label: ">", input: ">", type: "symbol" },
  { label: "<", input: "<", type: "symbol" },
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
      if (navigator.vibrate) navigator.vibrate(8);

      if (def.key === "__CTRL__") {
        setCtrlActive((prev) => !prev);
        if (ctrlTimeoutRef.current) clearTimeout(ctrlTimeoutRef.current);
        ctrlTimeoutRef.current = setTimeout(() => setCtrlActive(false), 3000);
        return;
      }

      if (def.ctrl) {
        wsClient.sendKeys(sessionId, `C-${def.ctrl}`);
        setCtrlActive(false);
        return;
      }

      if (ctrlActive && def.input && def.input.length === 1) {
        wsClient.sendKeys(sessionId, `C-${def.input}`);
        setCtrlActive(false);
        return;
      }

      if (def.key) {
        wsClient.sendKeys(sessionId, def.key);
        return;
      }

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
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, []);

  return (
    <div className="bg-[#0d0f14]/90 backdrop-blur-2xl border-t border-white/[0.06] safe-bottom select-none md:hidden">
      {/* ── Primary Row: always visible ──────────────── */}
      <div className="flex items-center gap-1 px-1.5 py-1.5">
        {/* Main keys */}
        <div className="flex gap-1 overflow-x-auto scrollbar-none flex-1">
          {PRIMARY_KEYS.map((def) => (
            <ToolbarKey
              key={def.label}
              def={def}
              ctrlActive={ctrlActive}
              onPress={sendKey}
            />
          ))}
        </div>

        {/* Action buttons */}
        <div className="flex gap-1 shrink-0 pl-1 border-l border-white/[0.06]">
          {/* Upload */}
          <button
            onPointerDown={(e) => {
              e.preventDefault();
              if (navigator.vibrate) navigator.vibrate(8);
              fileInputRef.current?.click();
            }}
            disabled={uploading}
            className={cn(
              "h-9 w-9 rounded-lg flex items-center justify-center",
              "transition-all duration-75 active:scale-90",
              uploading
                ? "text-accent animate-pulse bg-accent/10"
                : "text-white/30 hover:text-white/50 bg-white/[0.03] hover:bg-white/[0.06]",
            )}
            aria-label="Upload file"
          >
            <Upload className="h-3.5 w-3.5" />
          </button>

          {/* Expand toggle */}
          <button
            onPointerDown={(e) => {
              e.preventDefault();
              if (navigator.vibrate) navigator.vibrate(8);
              setExpanded(!expanded);
            }}
            className={cn(
              "h-9 w-9 rounded-lg flex items-center justify-center",
              "transition-all duration-75 active:scale-90",
              expanded
                ? "text-accent bg-accent/10 border border-accent/20"
                : "text-white/30 hover:text-white/50 bg-white/[0.03] hover:bg-white/[0.06]",
            )}
            aria-label={expanded ? "Collapse" : "More keys"}
          >
            {expanded ? (
              <ChevronUp className="h-3.5 w-3.5 rotate-180 transition-transform" />
            ) : (
              <Keyboard className="h-3.5 w-3.5" />
            )}
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="*/*"
          className="hidden"
          onChange={handleUpload}
          tabIndex={-1}
        />
      </div>

      {/* ── Expanded Section ──────────────────────────── */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            {/* Ctrl Combos */}
            <div className="px-1.5 pb-1.5">
              <div className="flex items-center gap-1.5 mb-1 px-1">
                <span className="text-[10px] font-medium text-white/20 uppercase tracking-wider">Ctrl +</span>
                <div className="flex-1 h-px bg-white/[0.04]" />
              </div>
              <div className="flex gap-1 overflow-x-auto scrollbar-none">
                {CTRL_KEYS.map((def) => (
                  <ToolbarKey
                    key={def.label}
                    def={def}
                    ctrlActive={false}
                    onPress={sendKey}
                  />
                ))}
              </div>
            </div>

            {/* Symbols */}
            <div className="px-1.5 pb-2">
              <div className="flex items-center gap-1.5 mb-1 px-1">
                <span className="text-[10px] font-medium text-white/20 uppercase tracking-wider">Symbols</span>
                <div className="flex-1 h-px bg-white/[0.04]" />
              </div>
              <div className="flex gap-1 overflow-x-auto scrollbar-none">
                {SYMBOL_KEYS.map((def, i) => (
                  <ToolbarKey
                    key={`${def.label}-${i}`}
                    def={def}
                    ctrlActive={ctrlActive}
                    onPress={sendKey}
                  />
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
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
  const isCtrlCombo = def.type === "ctrl-combo";
  const isNav = def.type === "nav";
  const isModifier = def.type === "modifier" && !isCtrlToggle;

  return (
    <button
      onPointerDown={(e) => {
        e.preventDefault();
        onPress(def);
      }}
      className={cn(
        "shrink-0 rounded-lg font-mono text-[12px] font-medium",
        "transition-all duration-75 active:scale-90",
        // Sizing
        isCtrlCombo
          ? "h-10 px-2.5 min-w-[2.75rem] flex flex-col items-center justify-center gap-0"
          : isNav
            ? "h-9 w-9 flex items-center justify-center text-sm"
            : isModifier
              ? "h-9 px-3 min-w-[2.75rem]"
              : "h-9 px-2.5 min-w-[2rem]",
        // Colors
        isActive
          ? "bg-accent/20 border border-accent/40 text-accent shadow-[0_0_8px_rgba(var(--color-accent-raw),0.15)]"
          : isCtrlToggle
            ? "bg-white/[0.04] border border-white/[0.06] text-white/50 hover:text-accent hover:border-accent/20"
            : isCtrlCombo
              ? "bg-white/[0.04] border border-white/[0.06] text-accent/80 hover:text-accent hover:bg-accent/10"
              : isModifier
                ? "bg-white/[0.06] border border-white/[0.08] text-white/60 hover:text-white/80"
                : isNav
                  ? "bg-white/[0.04] border border-white/[0.06] text-white/50 hover:text-white/70"
                  : "bg-white/[0.03] border border-white/[0.04] text-white/50 hover:text-white/70 hover:bg-white/[0.06]",
      )}
    >
      {isCtrlCombo ? (
        <>
          <span className="text-[12px] leading-none">{def.label}</span>
          {def.sublabel && (
            <span className="text-[8px] leading-none text-white/25 mt-0.5">{def.sublabel}</span>
          )}
        </>
      ) : (
        def.label
      )}
    </button>
  );
}
