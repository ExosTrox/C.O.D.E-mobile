// ── ProviderDetail ──────────────────────────────────────────
// Bottom-sheet modal showing full provider info, API key management, models.

import { useState } from "react";
import { Check, X, Loader2, Trash2, Copy, Terminal, Key } from "lucide-react";
import { toast } from "sonner";
import type { ProviderConfig, ProviderId } from "@code-mobile/core";
import { useStoreApiKey, useDeleteApiKey, useValidateApiKey } from "../../hooks/use-api-keys";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Badge } from "../ui/Badge";
import { cn } from "../../lib/cn";

// ── Types ──────────────────────────────────────────────────

interface ProviderDetailProps {
  provider: ProviderConfig;
  apiKey: { id: string; providerId: string; createdAt: string } | null;
  open: boolean;
  onClose: () => void;
}

// ── Provider colors ────────────────────────────────────────

const COLORS: Record<string, string> = {
  "claude-code": "#d97706",
  "openai-codex": "#10b981",
  "gemini-cli": "#3b82f6",
  deepseek: "#6366f1",
  openclaw: "#ec4899",
};

// ── Helpers ────────────────────────────────────────────────

function formatContextWindow(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return String(n);
}

function formatCost(n: number): string {
  if (n === 0) return "Free";
  if (n < 0.001) return `$${n.toFixed(5)}`;
  return `$${n.toFixed(4)}`;
}

function maskKey(key: string): string {
  if (key.length <= 8) return "****";
  return `...${key.slice(-4)}`;
}

// ── Component ──────────────────────────────────────────────

export function ProviderDetail({ provider, apiKey, open, onClose }: ProviderDetailProps) {
  const [newKey, setNewKey] = useState("");
  const [showKeyInput, setShowKeyInput] = useState(false);

  const storeApiKey = useStoreApiKey();
  const deleteApiKey = useDeleteApiKey();
  const validateApiKey = useValidateApiKey();

  const color = COLORS[provider.id] ?? "#7aa2f7";

  const handleSaveKey = async () => {
    if (!newKey.trim()) return;
    try {
      await storeApiKey.mutateAsync({ providerId: provider.id as ProviderId, apiKey: newKey.trim() });
      toast.success("API key saved");
      setNewKey("");
      setShowKeyInput(false);
    } catch {
      toast.error("Failed to save API key");
    }
  };

  const handleValidateKey = async () => {
    if (!newKey.trim()) return;
    try {
      const result = await validateApiKey.mutateAsync({
        providerId: provider.id as ProviderId,
        apiKey: newKey.trim(),
      });
      if (result.valid) {
        toast.success("API key is valid");
      } else {
        toast.error("API key is invalid");
      }
    } catch {
      toast.error("Validation failed");
    }
  };

  const handleDeleteKey = async () => {
    if (!apiKey) return;
    try {
      await deleteApiKey.mutateAsync(apiKey.id);
      toast.success("API key removed");
    } catch {
      toast.error("Failed to remove API key");
    }
  };

  const handleCopyInstall = () => {
    navigator.clipboard.writeText(provider.installCommand).catch(() => {});
    toast.success("Copied to clipboard");
  };

  return (
    <Modal open={open} onClose={onClose} title={provider.displayName}>
      <div className="space-y-5">
        {/* ── Header accent ──────────────────────────── */}
        <div
          className="h-1 w-12 rounded-full"
          style={{ backgroundColor: color }}
        />

        {/* ── Install command ────────────────────────── */}
        <div className="space-y-2">
          <h3 className="text-xs font-medium text-text-muted uppercase tracking-wider">Installation</h3>
          <button
            onClick={handleCopyInstall}
            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg bg-surface-2 border border-border hover:border-border-hover transition-colors text-left group"
          >
            <Terminal className="h-3.5 w-3.5 text-text-dimmed shrink-0" />
            <code className="text-xs text-text-secondary font-mono truncate flex-1">
              {provider.installCommand}
            </code>
            <Copy className="h-3.5 w-3.5 text-text-dimmed opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
          </button>
        </div>

        {/* ── API Key section ────────────────────────── */}
        {provider.requiresApiKey && (
          <div className="space-y-2">
            <h3 className="text-xs font-medium text-text-muted uppercase tracking-wider">API Key</h3>

            {apiKey && !showKeyInput ? (
              <div className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-surface-2 border border-border">
                <div className="flex items-center gap-2">
                  <Key className="h-3.5 w-3.5 text-success" />
                  <span className="text-sm text-text-secondary">
                    Key configured <span className="font-mono text-text-muted">({maskKey(apiKey.id)})</span>
                  </span>
                </div>
                <button
                  onClick={handleDeleteKey}
                  disabled={deleteApiKey.isPending}
                  className="p-1.5 rounded hover:bg-error/10 text-text-muted hover:text-error transition-colors"
                >
                  {deleteApiKey.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {!showKeyInput && !apiKey ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setShowKeyInput(true)}
                    className="w-full"
                  >
                    <Key className="h-3.5 w-3.5" />
                    Add API Key
                  </Button>
                ) : (
                  <>
                    <Input
                      type="password"
                      placeholder="sk-..."
                      value={newKey}
                      onChange={(e) => setNewKey(e.target.value)}
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={handleSaveKey}
                        disabled={!newKey.trim() || storeApiKey.isPending}
                        className="flex-1"
                      >
                        {storeApiKey.isPending ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Check className="h-3.5 w-3.5" />
                        )}
                        Save
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={handleValidateKey}
                        disabled={!newKey.trim() || validateApiKey.isPending}
                      >
                        {validateApiKey.isPending ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          "Validate"
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setShowKeyInput(false);
                          setNewKey("");
                        }}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Models list ────────────────────────────── */}
        <div className="space-y-2">
          <h3 className="text-xs font-medium text-text-muted uppercase tracking-wider">
            Models ({provider.models.length})
          </h3>
          <div className="space-y-1.5">
            {provider.models.map((model) => (
              <div
                key={model.id}
                className={cn(
                  "flex items-center justify-between px-3 py-2.5 rounded-lg",
                  "bg-surface-2 border border-border",
                  model.id === provider.defaultModel && "border-accent/30",
                )}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-text-primary truncate">{model.name}</span>
                    {model.id === provider.defaultModel && (
                      <Badge variant="info">default</Badge>
                    )}
                  </div>
                  <span className="text-xs text-text-muted">
                    {formatContextWindow(model.contextWindow)} context
                  </span>
                </div>
                <div className="text-right shrink-0 ml-3">
                  <div className="text-xs text-text-muted">
                    {formatCost(model.costPer1kInput)}/1K in
                  </div>
                  <div className="text-xs text-text-dimmed">
                    {formatCost(model.costPer1kOutput)}/1K out
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}
