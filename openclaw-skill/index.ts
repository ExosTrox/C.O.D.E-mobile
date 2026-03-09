// ── CODE Mobile — OpenClaw Skill ────────────────────────────
// Generates one-time access codes for CODE Mobile terminal.
//
// Users say: "terminal", "give me a code", "code mobile"
// OpenClaw replies with a 6-character code + the URL.

const DAEMON_URL = process.env.CODE_MOBILE_URL || "http://localhost:3000";
const WEB_URL = "https://code.gilbergarcia.com";

export default {
  command: "terminal",
  aliases: ["code", "code-mobile", "give me a terminal", "terminal code"],
  description: "Get an access code for CODE Mobile terminal",

  async handler() {
    try {
      const res = await fetch(`${DAEMON_URL}/internal/generate-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        return `Failed to generate code: ${(error as Record<string, unknown>).message || res.statusText}`;
      }

      const json = (await res.json()) as {
        success: boolean;
        data: { code: string; expiresIn: number };
      };

      if (!json.success) {
        return "Failed to generate access code. Is the CODE Mobile daemon running?";
      }

      const { code, expiresIn } = json.data;
      const minutes = Math.floor(expiresIn / 60);

      return [
        `*Your CODE Mobile access code:*`,
        ``,
        `\`${code}\``,
        ``,
        `Open ${WEB_URL} and enter this code.`,
        `Expires in ${minutes} minutes. Single use only.`,
      ].join("\n");
    } catch {
      return "Could not reach CODE Mobile daemon. Make sure it's running on this server.";
    }
  },
};
