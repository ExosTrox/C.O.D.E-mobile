import type { OpenClawPluginApi } from "openclaw/plugin-sdk";

const WEB_URL = "https://code.gilbergarcia.com";

type CodeMobileConfig = {
  CODE_MOBILE_URL?: string;
};

export default function register(api: OpenClawPluginApi) {
  const pluginCfg = (api.pluginConfig ?? {}) as CodeMobileConfig;
  const daemonUrl = pluginCfg.CODE_MOBILE_URL?.trim() || "http://localhost:80";

  api.registerCommand({
    name: "terminal",
    description: "Get an access code for CODE Mobile terminal",
    acceptsArgs: false,
    handler: async () => {
      try {
        const res = await fetch(`${daemonUrl}/internal/generate-code`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });

        if (!res.ok) {
          return { text: "Failed to generate code. Is the CODE Mobile daemon running?" };
        }

        const json = (await res.json()) as {
          success: boolean;
          data: { code: string; expiresIn: number };
        };

        if (!json.success) {
          return { text: "Failed to generate access code." };
        }

        const { code, expiresIn } = json.data;
        const minutes = Math.floor(expiresIn / 60);

        return {
          text: [
            "*Your CODE Mobile access code:*",
            "",
            `\`${code}\``,
            "",
            `Open ${WEB_URL} and enter this code.`,
            `Expires in ${minutes} minutes. Single use only.`,
          ].join("\n"),
        };
      } catch {
        return { text: "Could not reach CODE Mobile daemon. Make sure it's running." };
      }
    },
  });
}
