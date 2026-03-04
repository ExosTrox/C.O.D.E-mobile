// ── API Key Routes ──────────────────────────────────────────
// POST   /          — store an API key (encrypted)
// GET    /          — list stored keys (no secrets)
// DELETE /:id       — delete an API key
// POST   /validate  — validate an API key with provider

import { Hono } from "hono";
import type { ApiResponse, ProviderId } from "@code-mobile/core";
import type { DecodedToken } from "../auth/auth.service.js";
import type { ApiKeyService } from "./apikey.service.js";

interface ApiKeyEnv {
  Variables: {
    requestId: string;
    user: DecodedToken;
  };
}

const VALID_PROVIDERS: ProviderId[] = [
  "claude-code",
  "openai-codex",
  "gemini-cli",
  "deepseek",
  "openclaw",
];

export function createApiKeyRoutes(apiKeyService: ApiKeyService) {
  const router = new Hono<ApiKeyEnv>();

  // GET / — list all stored keys (metadata only, no secrets)
  router.get("/", (c) => {
    const keys = apiKeyService.list();
    const body: ApiResponse<typeof keys> = { success: true, data: keys };
    return c.json(body);
  });

  // POST / — store/update an API key
  router.post("/", async (c) => {
    const { providerId, apiKey, label } = await c.req.json();

    if (!providerId || !apiKey) {
      const body: ApiResponse<never> = {
        success: false,
        error: { code: "MISSING_FIELDS", message: "providerId and apiKey are required" },
      };
      return c.json(body, 400);
    }

    if (!VALID_PROVIDERS.includes(providerId)) {
      const body: ApiResponse<never> = {
        success: false,
        error: { code: "INVALID_PROVIDER", message: `Unknown provider: ${providerId}` },
      };
      return c.json(body, 400);
    }

    const id = await apiKeyService.store(providerId as ProviderId, apiKey, label);
    const body: ApiResponse<{ id: string }> = { success: true, data: { id } };
    return c.json(body, 201);
  });

  // DELETE /:id — delete an API key
  router.delete("/:id", (c) => {
    const { id } = c.req.param();
    const deleted = apiKeyService.delete(id);

    if (!deleted) {
      const body: ApiResponse<never> = {
        success: false,
        error: { code: "NOT_FOUND", message: "API key not found" },
      };
      return c.json(body, 404);
    }

    const body: ApiResponse<{ message: string }> = {
      success: true,
      data: { message: "API key deleted" },
    };
    return c.json(body);
  });

  // POST /validate — validate an API key with a quick provider check
  router.post("/validate", async (c) => {
    const { providerId, apiKey } = await c.req.json();

    if (!providerId || !apiKey) {
      const body: ApiResponse<never> = {
        success: false,
        error: { code: "MISSING_FIELDS", message: "providerId and apiKey are required" },
      };
      return c.json(body, 400);
    }

    // Basic format validation per provider
    const valid = validateKeyFormat(providerId as ProviderId, apiKey);
    const body: ApiResponse<{ valid: boolean }> = { success: true, data: { valid } };
    return c.json(body);
  });

  return router;
}

function validateKeyFormat(providerId: ProviderId, apiKey: string): boolean {
  const key = apiKey.trim();
  if (key.length < 10) return false;

  switch (providerId) {
    case "openai-codex":
      return key.startsWith("sk-");
    case "gemini-cli":
      return key.startsWith("AI") || key.length >= 39;
    case "deepseek":
      return key.startsWith("sk-") || key.length >= 20;
    case "claude-code":
      return key.startsWith("sk-ant-") || key.length >= 20;
    case "openclaw":
      return true; // No API key needed
    default:
      return key.length >= 10;
  }
}
