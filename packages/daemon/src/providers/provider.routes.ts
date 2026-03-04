// ── Provider Routes ─────────────────────────────────────────
// GET  /          — list all providers with status
// GET  /:id       — get a single provider with status

import { Hono } from "hono";
import { PROVIDERS } from "@code-mobile/core";
import type { ApiResponse, ProviderId, ProviderConfig } from "@code-mobile/core";
import type { DecodedToken } from "../auth/auth.service.js";
import type { ProviderRegistry } from "@code-mobile/providers";
import type { ApiKeyService } from "../apikeys/apikey.service.js";

interface ProviderEnv {
  Variables: {
    requestId: string;
    user: DecodedToken;
  };
}

interface ProviderWithStatus extends ProviderConfig {
  status: "ready" | "needs_key" | "not_installed" | "error";
  installed: boolean;
  hasApiKey: boolean;
}

export function createProviderRoutes(
  registry: ProviderRegistry,
  apiKeyService: ApiKeyService,
) {
  const router = new Hono<ProviderEnv>();

  // GET / — list all providers with availability status
  router.get("/", async (c) => {
    const availability = await registry.checkAvailability();
    const providers: ProviderWithStatus[] = [];

    for (const [id, config] of Object.entries(PROVIDERS)) {
      const providerId = id as ProviderId;
      const installed = availability.get(providerId) ?? false;
      const hasApiKey = !config.requiresApiKey || apiKeyService.hasKey(providerId);

      let status: ProviderWithStatus["status"];
      if (!installed) {
        status = "not_installed";
      } else if (config.requiresApiKey && !hasApiKey) {
        status = "needs_key";
      } else {
        status = "ready";
      }

      providers.push({ ...config, status, installed, hasApiKey });
    }

    const body: ApiResponse<ProviderWithStatus[]> = { success: true, data: providers };
    return c.json(body);
  });

  // GET /:id — get a single provider with status
  router.get("/:id", async (c) => {
    const { id } = c.req.param();
    const providerId = id as ProviderId;
    const config = PROVIDERS[providerId];

    if (!config) {
      const body: ApiResponse<never> = {
        success: false,
        error: { code: "NOT_FOUND", message: `Unknown provider: ${id}` },
      };
      return c.json(body, 404);
    }

    let installed = false;
    try {
      if (registry.has(providerId)) {
        installed = await registry.get(providerId).isAvailable();
      }
    } catch {
      // Provider check failed
    }

    const hasApiKey = !config.requiresApiKey || apiKeyService.hasKey(providerId);

    let status: ProviderWithStatus["status"];
    if (!installed) {
      status = "not_installed";
    } else if (config.requiresApiKey && !hasApiKey) {
      status = "needs_key";
    } else {
      status = "ready";
    }

    const data: ProviderWithStatus = { ...config, status, installed, hasApiKey };
    const body: ApiResponse<ProviderWithStatus> = { success: true, data };
    return c.json(body);
  });

  return router;
}
