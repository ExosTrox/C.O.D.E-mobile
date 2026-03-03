import { parseArgs } from "util";
import { resolve } from "path";
import { homedir } from "os";

export interface Config {
  port: number;
  host: string;
  dataDir: string;
  corsOrigins: string[];
  nodeEnv: "development" | "production" | "test";
  version: string;
}

function resolveDataDir(input: string): string {
  if (input.startsWith("~")) {
    return resolve(homedir(), input.slice(2));
  }
  return resolve(input);
}

export function loadConfig(): Config {
  const { values } = parseArgs({
    args: Bun.argv,
    options: {
      port: { type: "string", short: "p" },
      host: { type: "string", short: "h" },
      "data-dir": { type: "string", short: "d" },
    },
    strict: false,
    allowPositionals: true,
  });

  const envPort = process.env["PORT"];
  const envHost = process.env["HOST"];
  const envDataDir = process.env["DATA_DIR"];
  const envCorsOrigins = process.env["CORS_ORIGINS"];
  const envNodeEnv = process.env["NODE_ENV"];

  // parseArgs values are string | boolean — coerce to string
  const rawPort = String(values["port"] ?? envPort ?? "3000");
  const port = parseInt(rawPort, 10);
  if (isNaN(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid port: ${rawPort}`);
  }

  const host = String(values["host"] ?? envHost ?? "0.0.0.0");
  const dataDir = resolveDataDir(
    String(values["data-dir"] ?? envDataDir ?? "~/.codemobile"),
  );

  const corsOrigins = envCorsOrigins
    ? envCorsOrigins.split(",").map((s) => s.trim())
    : ["http://localhost:5173", "http://localhost:3000"];

  const nodeEnv = (envNodeEnv ?? "development") as Config["nodeEnv"];
  if (!["development", "production", "test"].includes(nodeEnv)) {
    throw new Error(`Invalid NODE_ENV: ${nodeEnv}`);
  }

  return {
    port,
    host,
    dataDir,
    corsOrigins,
    nodeEnv,
    version: "0.0.1",
  };
}
