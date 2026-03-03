// ── Permission Policy Service ────────────────────────────────
// Evaluates tool-use permission policies stored in SQLite.

import type { Database } from "bun:sqlite";

// ── Types ───────────────────────────────────────────────────

export type PermissionAction = "allow" | "deny" | "ask";

export interface PermissionPolicy {
  id: string;
  sessionId: string | null;
  tool: string;
  pathPattern: string | null;
  action: PermissionAction;
  createdAt: number;
}

export interface PermissionRequest {
  id: string;
  sessionId: string;
  tool: string;
  input: string;
  status: "pending" | "allowed" | "denied" | "expired";
  createdAt: number;
  resolvedAt: number | null;
}

interface PolicyRow {
  id: string;
  session_id: string | null;
  tool: string;
  path_pattern: string | null;
  action: string;
  created_at: number;
}

interface RequestRow {
  id: string;
  session_id: string;
  tool: string;
  input: string;
  status: string;
  created_at: number;
  resolved_at: number | null;
}

// ── Default policies ────────────────────────────────────────

const DEFAULT_POLICIES: Record<string, PermissionAction> = {
  Read: "allow",
  Glob: "allow",
  Grep: "allow",
  View: "allow",
  LS: "allow",
  Edit: "ask",
  Write: "ask",
  Bash: "ask",
  Execute: "ask",
  MultiEdit: "ask",
  NotebookEdit: "ask",
};

// ── Service ─────────────────────────────────────────────────

export class PermissionService {
  constructor(private readonly db: Database) {}

  // ── Policy CRUD ─────────────────────────────────────────

  listPolicies(sessionId: string): PermissionPolicy[] {
    const rows = this.db
      .query<PolicyRow, [string]>(
        "SELECT * FROM permission_policies WHERE session_id = ? OR session_id IS NULL ORDER BY created_at",
      )
      .all(sessionId);
    return rows.map(rowToPolicy);
  }

  setPolicies(sessionId: string, policies: { tool: string; pathPattern?: string; action: PermissionAction }[]): void {
    // Replace all session-specific policies
    this.db.run("DELETE FROM permission_policies WHERE session_id = ?", [sessionId]);

    const stmt = this.db.prepare(
      "INSERT INTO permission_policies (id, session_id, tool, path_pattern, action) VALUES (?, ?, ?, ?, ?)",
    );

    for (const p of policies) {
      stmt.run(crypto.randomUUID(), sessionId, p.tool, p.pathPattern ?? null, p.action);
    }
  }

  // ── Policy evaluation ─────────────────────────────────────

  evaluatePolicy(
    sessionId: string,
    tool: string,
    input: Record<string, unknown>,
  ): PermissionAction {
    // Check session-specific policies first (most specific wins)
    const sessionPolicies = this.db
      .query<PolicyRow, [string, string]>(
        "SELECT * FROM permission_policies WHERE session_id = ? AND tool = ? ORDER BY created_at DESC",
      )
      .all(sessionId, tool);

    for (const row of sessionPolicies) {
      if (row.path_pattern) {
        // Check if the input contains a path that matches the pattern
        const path = extractPath(input);
        if (path && matchesPattern(path, row.path_pattern)) {
          return row.action as PermissionAction;
        }
      } else {
        // No path pattern — applies to all uses of this tool
        return row.action as PermissionAction;
      }
    }

    // Check global policies (session_id IS NULL)
    const globalPolicies = this.db
      .query<PolicyRow, [string]>(
        "SELECT * FROM permission_policies WHERE session_id IS NULL AND tool = ? ORDER BY created_at DESC",
      )
      .all(tool);

    for (const row of globalPolicies) {
      return row.action as PermissionAction;
    }

    // Fall back to defaults
    return DEFAULT_POLICIES[tool] ?? "ask";
  }

  // ── Permission requests ───────────────────────────────────

  createRequest(sessionId: string, tool: string, input: string): PermissionRequest {
    const id = crypto.randomUUID();
    this.db.run(
      "INSERT INTO permission_requests (id, session_id, tool, input) VALUES (?, ?, ?, ?)",
      [id, sessionId, tool, input],
    );

    const row = this.db
      .query<RequestRow, [string]>("SELECT * FROM permission_requests WHERE id = ?")
      .get(id);
    if (!row) throw new Error("Failed to create permission request");
    return rowToRequest(row);
  }

  getRequest(id: string): PermissionRequest | null {
    const row = this.db
      .query<RequestRow, [string]>("SELECT * FROM permission_requests WHERE id = ?")
      .get(id);
    return row ? rowToRequest(row) : null;
  }

  getPendingRequests(sessionId: string): PermissionRequest[] {
    const rows = this.db
      .query<RequestRow, [string]>(
        "SELECT * FROM permission_requests WHERE session_id = ? AND status = 'pending' ORDER BY created_at",
      )
      .all(sessionId);
    return rows.map(rowToRequest);
  }

  resolveRequest(id: string, decision: "allowed" | "denied"): PermissionRequest | null {
    this.db.run(
      "UPDATE permission_requests SET status = ?, resolved_at = unixepoch() WHERE id = ? AND status = 'pending'",
      [decision, id],
    );
    return this.getRequest(id);
  }

  /** Expire stale pending requests older than given seconds. */
  expireStaleRequests(maxAgeSeconds: number): number {
    const result = this.db.run(
      "UPDATE permission_requests SET status = 'expired', resolved_at = unixepoch() WHERE status = 'pending' AND created_at < unixepoch() - ?",
      [maxAgeSeconds],
    );
    return result.changes;
  }
}

// ── Helpers ─────────────────────────────────────────────────

function rowToPolicy(row: PolicyRow): PermissionPolicy {
  return {
    id: row.id,
    sessionId: row.session_id,
    tool: row.tool,
    pathPattern: row.path_pattern,
    action: row.action as PermissionAction,
    createdAt: row.created_at,
  };
}

function rowToRequest(row: RequestRow): PermissionRequest {
  return {
    id: row.id,
    sessionId: row.session_id,
    tool: row.tool,
    input: row.input,
    status: row.status as PermissionRequest["status"],
    createdAt: row.created_at,
    resolvedAt: row.resolved_at,
  };
}

function extractPath(input: Record<string, unknown>): string | null {
  // Common tool input fields that contain paths
  if (typeof input.file_path === "string") return input.file_path;
  if (typeof input.path === "string") return input.path;
  if (typeof input.command === "string") return input.command;
  return null;
}

function matchesPattern(path: string, pattern: string): boolean {
  // Simple glob matching: * matches any segment, ** matches any depth
  const regex = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*/g, "___GLOBSTAR___")
    .replace(/\*/g, "[^/]*")
    .replace(/___GLOBSTAR___/g, ".*");
  return new RegExp(`^${regex}$`).test(path);
}
