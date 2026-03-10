// ── File Upload Routes ──────────────────────────────────────
// POST /upload — upload a file and SCP it to the user's machine via SSH tunnel

import { Hono } from "hono";
import { tmpdir } from "os";
import { join } from "path";
import { randomUUID } from "crypto";
import type { ApiResponse } from "@code-mobile/core";
import type { DecodedToken } from "../auth/auth.service.js";
import type { MachineService } from "../machines/machine.service.js";

interface FilesEnv {
  Variables: {
    requestId: string;
    user: DecodedToken;
  };
}

interface RemoteSSHConfig {
  host: string;
  port: number;
  user: string;
  identityFile: string;
}

// Max file size: 100 MB
const MAX_FILE_SIZE = 100 * 1024 * 1024;

export function createFileRoutes(machineService: MachineService, legacySSH?: RemoteSSHConfig) {
  const router = new Hono<FilesEnv>();

  // POST /upload — upload file and SCP to user's machine
  router.post("/upload", async (c) => {
    const userId = c.get("user").sub;

    // Resolve SSH config: per-user machine first, then legacy fallback
    const sshConfig = machineService.getSSHConfigForUser(userId) ?? legacySSH;

    if (!sshConfig) {
      const body: ApiResponse<never> = {
        success: false,
        error: {
          code: "SSH_NOT_CONFIGURED",
          message: "No paired machine found. Pair your machine first.",
        },
      };
      return c.json(body, 503);
    }

    // Parse multipart form data
    let formData: FormData;
    try {
      formData = await c.req.formData();
    } catch {
      const body: ApiResponse<never> = {
        success: false,
        error: { code: "INVALID_FORM", message: "Expected multipart form data" },
      };
      return c.json(body, 400);
    }

    const file = formData.get("file");
    if (!file || !(file instanceof File)) {
      const body: ApiResponse<never> = {
        success: false,
        error: { code: "MISSING_FILE", message: "A 'file' field is required" },
      };
      return c.json(body, 400);
    }

    if (file.size > MAX_FILE_SIZE) {
      const body: ApiResponse<never> = {
        success: false,
        error: {
          code: "FILE_TOO_LARGE",
          message: `File exceeds max size of ${MAX_FILE_SIZE / 1024 / 1024} MB`,
        },
      };
      return c.json(body, 413);
    }

    // Sanitize filename: strip path separators, null bytes
    const rawName = file.name || "upload";
    const safeName = rawName.replace(/[/\\:\0]/g, "_").replace(/^\.+/, "_");

    // Destination on the user's machine (default: ~/Downloads/)
    const destRaw = (formData.get("destination") as string) || "~/Downloads/";
    // Basic path traversal guard: reject null bytes
    if (destRaw.includes("\0")) {
      const body: ApiResponse<never> = {
        success: false,
        error: { code: "INVALID_PATH", message: "Invalid destination path" },
      };
      return c.json(body, 400);
    }

    // Normalize destination: ensure it ends with / for directory targets
    const destination = destRaw.endsWith("/") ? destRaw : destRaw + "/";
    const remotePath = `${destination}${safeName}`;

    // Write to temp file
    const tempPath = join(tmpdir(), `code-upload-${randomUUID()}-${safeName}`);

    try {
      const arrayBuffer = await file.arrayBuffer();
      await Bun.write(tempPath, arrayBuffer);

      // SCP to user's machine via SSH tunnel
      const scpArgs = [
        "scp",
        "-o", "StrictHostKeyChecking=no",
        "-o", "UserKnownHostsFile=/dev/null",
        "-o", "ConnectTimeout=10",
        "-i", sshConfig.identityFile,
        "-P", String(sshConfig.port),
        tempPath,
        `${sshConfig.user}@${sshConfig.host}:${remotePath}`,
      ];

      console.log(`  [FILES] Uploading ${safeName} (${file.size} bytes) → ${remotePath}`);

      const proc = Bun.spawn(scpArgs, {
        stdout: "pipe",
        stderr: "pipe",
        env: {
          ...process.env,
          PATH: `/opt/homebrew/bin:/usr/local/bin:${process.env.PATH}`,
        },
      });

      const exitCode = await proc.exited;

      if (exitCode !== 0) {
        const stderr = await new Response(proc.stderr).text();
        console.error(`  [FILES] SCP failed (exit ${exitCode}): ${stderr.trim()}`);
        const body: ApiResponse<never> = {
          success: false,
          error: {
            code: "SCP_FAILED",
            message: `File transfer failed: ${stderr.trim() || `exit code ${exitCode}`}`,
          },
        };
        return c.json(body, 502);
      }

      console.log(`  [FILES] Upload complete: ${remotePath}`);

      const body: ApiResponse<{ remotePath: string; fileName: string; size: number }> = {
        success: true,
        data: {
          remotePath,
          fileName: safeName,
          size: file.size,
        },
      };
      return c.json(body);
    } catch (err) {
      console.error(`  [FILES] Upload error:`, err);
      const body: ApiResponse<never> = {
        success: false,
        error: { code: "UPLOAD_ERROR", message: "Failed to process upload" },
      };
      return c.json(body, 500);
    } finally {
      // Clean up temp file
      try {
        const tempFile = Bun.file(tempPath);
        if (await tempFile.exists()) {
          const { unlink } = await import("fs/promises");
          await unlink(tempPath);
        }
      } catch {
        // Best effort cleanup
      }
    }
  });

  return router;
}
