// ── Analytics Routes ────────────────────────────────────────
// GET /overview?period=7d
// GET /sessions/:id
// GET /providers?period=30d
// GET /usage?period=7d&granularity=day

import { Hono } from "hono";
import type { ApiResponse } from "@code-mobile/core";
import type {
  AnalyticsService,
  AnalyticsOverview,
  ProviderBreakdown,
  UsageTrendPoint,
  SessionAnalytics,
} from "./analytics.service.js";

type Period = "24h" | "7d" | "30d";
type Granularity = "hour" | "day";

function parsePeriod(val: string | undefined): Period {
  if (val === "24h" || val === "7d" || val === "30d") return val;
  return "7d";
}

function parseGranularity(val: string | undefined): Granularity {
  if (val === "hour" || val === "day") return val;
  return "day";
}

export function createAnalyticsRoutes(analyticsService: AnalyticsService) {
  const router = new Hono();

  // GET /overview?period=7d
  router.get("/overview", (c) => {
    const period = parsePeriod(c.req.query("period"));
    const overview = analyticsService.getOverview(period);
    const body: ApiResponse<AnalyticsOverview> = { success: true, data: overview };
    return c.json(body);
  });

  // GET /sessions/:id
  router.get("/sessions/:id", (c) => {
    const sessionId = c.req.param("id");
    const analytics = analyticsService.getSessionAnalytics(sessionId);
    const body: ApiResponse<SessionAnalytics> = { success: true, data: analytics };
    return c.json(body);
  });

  // GET /providers?period=30d
  router.get("/providers", (c) => {
    const period = parsePeriod(c.req.query("period"));
    const breakdown = analyticsService.getProviderBreakdown(period);
    const body: ApiResponse<ProviderBreakdown[]> = { success: true, data: breakdown };
    return c.json(body);
  });

  // GET /usage?period=7d&granularity=day
  router.get("/usage", (c) => {
    const period = parsePeriod(c.req.query("period"));
    const granularity = parseGranularity(c.req.query("granularity"));
    const trend = analyticsService.getUsageTrend(period, granularity);
    const body: ApiResponse<UsageTrendPoint[]> = { success: true, data: trend };
    return c.json(body);
  });

  return router;
}
