// ── API Key Management with AES-256-GCM Encryption ─────────
import { existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import type { Database } from "bun:sqlite";
import type { ProviderId } from "@code-mobile/core";

interface ApiKeyRow {
  id: string;
  provider_id: string;
  encrypted_key: string;
  iv: string;
  auth_tag: string;
  label: string;
  created_at: number;
  updated_at: number;
}

export interface ApiKeyInfo {
  id: string;
  providerId: string;
  label: string;
  createdAt: string;
  updatedAt: string;
}

export class ApiKeyService {
  private masterKey: Uint8Array;
  private readonly db: Database;

  constructor(db: Database, dataDir: string) {
    this.db = db;
    this.masterKey = this.loadOrCreateMasterKey(dataDir);
  }

  // ── Master Key Management ─────────────────────────────────

  private loadOrCreateMasterKey(dataDir: string): Uint8Array {
    const keyPath = join(dataDir, "master.key");

    if (existsSync(keyPath)) {
      const hex = readFileSync(keyPath, "utf-8").trim();
      return new Uint8Array(Buffer.from(hex, "hex"));
    }

    // Generate a 256-bit master key
    const key = crypto.getRandomValues(new Uint8Array(32));
    writeFileSync(keyPath, Buffer.from(key).toString("hex"), { mode: 0o600 });
    return key;
  }

  // ── Encryption ────────────────────────────────────────────

  private async encrypt(plaintext: string): Promise<{ ciphertext: string; iv: string; authTag: string }> {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await crypto.subtle.importKey(
      "raw",
      this.masterKey.buffer as ArrayBuffer,
      { name: "AES-GCM" },
      false,
      ["encrypt"],
    );

    const encoded = new TextEncoder().encode(plaintext);
    const encrypted = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv, tagLength: 128 },
      key,
      encoded,
    );

    // AES-GCM appends the auth tag to the ciphertext
    const encryptedArray = new Uint8Array(encrypted);
    const ciphertext = encryptedArray.slice(0, -16);
    const authTag = encryptedArray.slice(-16);

    return {
      ciphertext: Buffer.from(ciphertext).toString("base64"),
      iv: Buffer.from(iv).toString("base64"),
      authTag: Buffer.from(authTag).toString("base64"),
    };
  }

  private async decrypt(ciphertext: string, iv: string, authTag: string): Promise<string> {
    const key = await crypto.subtle.importKey(
      "raw",
      this.masterKey.buffer as ArrayBuffer,
      { name: "AES-GCM" },
      false,
      ["decrypt"],
    );

    const ciphertextBytes = Buffer.from(ciphertext, "base64");
    const authTagBytes = Buffer.from(authTag, "base64");
    const ivBytes = Buffer.from(iv, "base64");

    // Reconstruct: ciphertext + authTag
    const combined = new Uint8Array(ciphertextBytes.length + authTagBytes.length);
    combined.set(ciphertextBytes, 0);
    combined.set(authTagBytes, ciphertextBytes.length);

    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: ivBytes, tagLength: 128 },
      key,
      combined,
    );

    return new TextDecoder().decode(decrypted);
  }

  // ── CRUD Operations ───────────────────────────────────────

  async store(providerId: ProviderId, apiKey: string, label?: string): Promise<string> {
    const id = crypto.randomUUID();
    const { ciphertext, iv, authTag } = await this.encrypt(apiKey);

    // Upsert: one key per provider
    this.db.run(
      `INSERT INTO api_keys (id, provider_id, encrypted_key, iv, auth_tag, label)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(provider_id) DO UPDATE SET
         id = excluded.id,
         encrypted_key = excluded.encrypted_key,
         iv = excluded.iv,
         auth_tag = excluded.auth_tag,
         label = excluded.label,
         updated_at = unixepoch()`,
      [id, providerId, ciphertext, iv, authTag, label ?? ""],
    );

    return id;
  }

  list(): ApiKeyInfo[] {
    const rows = this.db
      .query<ApiKeyRow, []>(
        "SELECT * FROM api_keys ORDER BY created_at DESC",
      )
      .all();

    return rows.map((r) => ({
      id: r.id,
      providerId: r.provider_id,
      label: r.label,
      createdAt: new Date(r.created_at * 1000).toISOString(),
      updatedAt: new Date(r.updated_at * 1000).toISOString(),
    }));
  }

  async getDecrypted(providerId: ProviderId): Promise<string | null> {
    const row = this.db
      .query<ApiKeyRow, [string]>(
        "SELECT * FROM api_keys WHERE provider_id = ?",
      )
      .get(providerId);

    if (!row) return null;

    return this.decrypt(row.encrypted_key, row.iv, row.auth_tag);
  }

  hasKey(providerId: ProviderId): boolean {
    const row = this.db
      .query<{ count: number }, [string]>(
        "SELECT COUNT(*) as count FROM api_keys WHERE provider_id = ?",
      )
      .get(providerId);
    return (row?.count ?? 0) > 0;
  }

  delete(id: string): boolean {
    const result = this.db.run("DELETE FROM api_keys WHERE id = ?", [id]);
    return result.changes > 0;
  }

  deleteByProvider(providerId: ProviderId): boolean {
    const result = this.db.run("DELETE FROM api_keys WHERE provider_id = ?", [providerId]);
    return result.changes > 0;
  }
}
