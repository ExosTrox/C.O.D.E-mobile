// ── REST API Client ─────────────────────────────────────────

import type {
  ApiResponse,
  Session,
  SessionCreateOptions,
  SessionStatus,
  ProviderId,
  ProviderConfig,
  AuthTokens,
} from "@code-mobile/core";
import { useAuthStore } from "../stores/auth.store";
import { useConnectionStore } from "../stores/connection.store";

// ── Error class ────────────────────────────────────────────

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// ── Response types for auth endpoints ──────────────────────

interface SetupResponse {
  userId: string;
  totp: { secret: string; uri: string; qrCodeDataUrl: string };
}

interface HealthResponse {
  status: string;
  version: string;
  uptime: number;
  sessions: number;
}

interface OutputResponse {
  output: string;
  offset: number;
  size: number;
}

// ── ApiClient ──────────────────────────────────────────────

const REQUEST_TIMEOUT = 15_000;

export class ApiClient {
  private baseUrl: string;
  private refreshing: Promise<AuthTokens> | null = null;

  constructor() {
    const stored = localStorage.getItem("code-mobile-server-url");
    this.baseUrl = stored ?? window.location.origin;
  }

  get serverUrl(): string {
    return this.baseUrl;
  }

  setServerUrl(url: string): void {
    this.baseUrl = url.replace(/\/+$/, "");
    localStorage.setItem("code-mobile-server-url", this.baseUrl);
  }

  // ── Core request ────────────────────────────────────────

  private getAuthStore() {
    return useAuthStore.getState();
  }

  private getConnectionStore() {
    return useConnectionStore.getState();
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    const { accessToken } = this.getAuthStore();
    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`;
    }
    return headers;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    skipAuth = false,
  ): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    try {
      const url = `${this.baseUrl}/api/v1${path}`;
      const headers = skipAuth
        ? { "Content-Type": "application/json" }
        : this.getHeaders();

      const res = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      // 401: try token refresh once then retry
      if (res.status === 401 && !skipAuth) {
        const refreshed = await this.tryRefresh();
        if (refreshed) {
          return this.request<T>(method, path, body, true);
        }
        // Refresh failed — redirect to login
        this.getAuthStore().logout();
        window.location.href = "/login";
        throw new ApiError(401, "UNAUTHORIZED", "Session expired");
      }

      const json = (await res.json()) as ApiResponse<T>;

      if (!json.success) {
        throw new ApiError(
          res.status,
          json.error.code,
          json.error.message,
        );
      }

      return json.data;
    } catch (err) {
      if (err instanceof ApiError) throw err;

      if (err instanceof DOMException && err.name === "AbortError") {
        throw new ApiError(0, "TIMEOUT", "Request timed out");
      }

      // Network error — update connection store
      try {
        this.getConnectionStore().setStatus("error");
      } catch {
        // Connection store may not be loaded yet
      }

      throw new ApiError(0, "NETWORK_ERROR", "Network request failed");
    } finally {
      clearTimeout(timer);
    }
  }

  private async tryRefresh(): Promise<boolean> {
    const { refreshToken, setTokens, logout } = this.getAuthStore();
    if (!refreshToken) return false;

    // Deduplicate concurrent refresh attempts
    if (!this.refreshing) {
      this.refreshing = this.request<AuthTokens>(
        "POST",
        "/auth/refresh",
        { refreshToken },
        true,
      ).finally(() => {
        this.refreshing = null;
      });
    }

    try {
      const tokens = await this.refreshing;
      setTokens(tokens.accessToken, tokens.refreshToken);
      return true;
    } catch {
      logout();
      return false;
    }
  }

  // ── Auth methods ────────────────────────────────────────

  setup(bootstrapToken: string, username: string, password: string) {
    return this.request<SetupResponse>(
      "POST",
      "/auth/setup",
      { bootstrapToken, username, password },
      true,
    );
  }

  verifyTotp(userId: string, totpCode: string, deviceId: string, deviceName: string) {
    return this.request<AuthTokens>(
      "POST",
      "/auth/setup/verify-totp",
      { userId, totpCode, deviceId, deviceName },
      true,
    );
  }

  login(password: string, totpCode: string, deviceName: string) {
    return this.request<AuthTokens>(
      "POST",
      "/auth/login",
      { password, totpCode, deviceName },
      true,
    );
  }

  refresh(refreshToken: string) {
    return this.request<AuthTokens>(
      "POST",
      "/auth/refresh",
      { refreshToken },
      true,
    );
  }

  logout(refreshToken: string) {
    return this.request<{ message: string }>(
      "POST",
      "/auth/logout",
      { refreshToken },
    );
  }

  // ── Session methods ─────────────────────────────────────

  createSession(options: SessionCreateOptions) {
    return this.request<Session>("POST", "/sessions", options);
  }

  listSessions(status?: SessionStatus, provider?: ProviderId) {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (provider) params.set("provider", provider);
    const qs = params.toString();
    return this.request<Session[]>("GET", `/sessions${qs ? `?${qs}` : ""}`);
  }

  getSession(id: string) {
    return this.request<Session>("GET", `/sessions/${id}`);
  }

  stopSession(id: string) {
    return this.request<{ message: string }>("DELETE", `/sessions/${id}`);
  }

  sendInput(id: string, text: string) {
    return this.request<{ message: string }>("POST", `/sessions/${id}/input`, { text });
  }

  sendKeys(id: string, keys: string) {
    return this.request<{ message: string }>("POST", `/sessions/${id}/keys`, { keys });
  }

  resizeTerminal(id: string, cols: number, rows: number) {
    return this.request<{ message: string }>("POST", `/sessions/${id}/resize`, { cols, rows });
  }

  getSessionOutput(id: string, offset = 0) {
    return this.request<OutputResponse>("GET", `/sessions/${id}/output?offset=${offset}`);
  }

  // ── Provider methods ────────────────────────────────────

  listProviders() {
    return this.request<ProviderConfig[]>("GET", "/providers");
  }

  getProvider(id: ProviderId) {
    return this.request<ProviderConfig>("GET", `/providers/${id}`);
  }

  // ── API key methods ─────────────────────────────────────

  listApiKeys() {
    return this.request<{ id: string; providerId: string; createdAt: string }[]>(
      "GET",
      "/api-keys",
    );
  }

  storeApiKey(providerId: ProviderId, apiKey: string) {
    return this.request<{ id: string }>(
      "POST",
      "/api-keys",
      { providerId, apiKey },
    );
  }

  deleteApiKey(id: string) {
    return this.request<{ message: string }>("DELETE", `/api-keys/${id}`);
  }

  validateApiKey(providerId: ProviderId, apiKey: string) {
    return this.request<{ valid: boolean }>(
      "POST",
      "/api-keys/validate",
      { providerId, apiKey },
    );
  }

  // ── Health ──────────────────────────────────────────────

  async checkHealth(): Promise<HealthResponse> {
    const res = await fetch(`${this.baseUrl}/health`);
    const json = (await res.json()) as ApiResponse<HealthResponse>;
    if (!json.success) {
      throw new ApiError(res.status, json.error.code, json.error.message);
    }
    return json.data;
  }
}

// ── Singleton ──────────────────────────────────────────────

export const apiClient = new ApiClient();
