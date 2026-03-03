import { createMiddleware } from "hono/factory";
import type { ApiResponse } from "@code-mobile/core";
import type { AuthService, DecodedToken } from "./auth.service.js";

interface AuthEnv {
  Variables: {
    requestId: string;
    user: DecodedToken;
  };
}

export function createAuthMiddleware(authService: AuthService) {
  return createMiddleware<AuthEnv>(async (c, next) => {
    const authHeader = c.req.header("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      const body: ApiResponse<never> = {
        success: false,
        error: { code: "UNAUTHORIZED", message: "Missing or invalid Authorization header" },
      };
      return c.json(body, 401);
    }

    const token = authHeader.slice(7);

    try {
      const decoded = await authService.verifyAccessToken(token);
      c.set("user", decoded);
      await next();
    } catch {
      const body: ApiResponse<never> = {
        success: false,
        error: { code: "UNAUTHORIZED", message: "Invalid or expired access token" },
      };
      return c.json(body, 401);
    }
  });
}
