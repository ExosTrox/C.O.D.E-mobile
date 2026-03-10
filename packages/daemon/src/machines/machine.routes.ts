// ── Machine Routes ──────────────────────────────────────────
// Endpoints for machine pairing and status.

import { Hono } from "hono";
import type { ApiResponse } from "@code-mobile/core";
import type { DecodedToken } from "../auth/auth.service.js";
import type { MachineService, MachineInfo } from "./machine.service.js";

interface MachineEnv {
  Variables: {
    requestId: string;
    user: DecodedToken;
  };
}

export function createMachineRoutes(machineService: MachineService): Hono<MachineEnv> {
  const app = new Hono<MachineEnv>();

  // ── POST /pair — Public: complete pairing (called by user's machine) ──
  app.post("/pair", async (c) => {
    const { token, sshUser, publicKey } = await c.req.json<{
      token: string;
      sshUser: string;
      publicKey?: string;
    }>();

    if (!token || !sshUser) {
      const body: ApiResponse<never> = {
        success: false,
        error: { code: "VALIDATION_ERROR", message: "token and sshUser are required" },
      };
      return c.json(body, 400);
    }

    const machine = machineService.redeemPairingToken(token, sshUser, publicKey);
    if (!machine) {
      const body: ApiResponse<never> = {
        success: false,
        error: { code: "INVALID_TOKEN", message: "Invalid or expired pairing token" },
      };
      return c.json(body, 401);
    }

    const body: ApiResponse<{ sshPort: number; status: string }> = {
      success: true,
      data: { sshPort: machine.ssh_port, status: machine.status },
    };
    return c.json(body);
  });

  // ── GET /status — Get current user's machine status ─────
  app.get("/status", async (c) => {
    const userId = c.get("user").sub;
    const machine = machineService.getMachineByUser(userId);

    if (!machine) {
      const body: ApiResponse<{ paired: false; pairingCommand: string }> = {
        success: true,
        data: {
          paired: false,
          pairingCommand: machineService.createPairingToken(userId).pairingCommand,
        },
      };
      return c.json(body);
    }

    // Check health
    const status = await machineService.checkMachineHealth(userId);

    const body: ApiResponse<{
      paired: true;
      status: string;
      sshPort: number;
      label: string | null;
    }> = {
      success: true,
      data: {
        paired: true,
        status,
        sshPort: machine.ssh_port,
        label: machine.label,
      },
    };
    return c.json(body);
  });

  // ── POST /pair-token — Generate a new pairing token ─────
  app.post("/pair-token", (c) => {
    const userId = c.get("user").sub;
    const pairing = machineService.createPairingToken(userId);

    const body: ApiResponse<{
      sshPort: number;
      pairingToken: string;
      pairingCommand: string;
    }> = {
      success: true,
      data: {
        sshPort: pairing.sshPort,
        pairingToken: pairing.pairingToken,
        pairingCommand: pairing.pairingCommand,
      },
    };
    return c.json(body);
  });

  // ── POST /unpair — Remove machine pairing ──────────────
  app.post("/unpair", (c) => {
    const userId = c.get("user").sub;
    machineService.deleteMachine(userId);

    const body: ApiResponse<{ message: string }> = {
      success: true,
      data: { message: "Machine unpaired" },
    };
    return c.json(body);
  });

  // ── GET / — List all machines (admin only) ──────────────
  app.get("/", (c) => {
    const machines = machineService.listMachines();

    const body: ApiResponse<MachineInfo[]> = {
      success: true,
      data: machines,
    };
    return c.json(body);
  });

  return app;
}
