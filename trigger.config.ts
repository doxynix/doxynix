import { execSync } from "child_process";
import { defineConfig } from "@trigger.dev/sdk/v3";

export default defineConfig({
  project: "proj_whmkduzdqfzcgoyuhdyp",
  runtime: "node",
  logLevel: "log",
  maxDuration: 3600,
  retries: {
    enabledInDev: true,
    default: {
      maxAttempts: 3,
      minTimeoutInMs: 1000,
      maxTimeoutInMs: 10000,
      factor: 2,
      randomize: true,
    },
  },
  dirs: ["./src/trigger"],

  build: {
    extensions: [
      {
        name: "zenstack-generate",
        onBuildStart: async () => {
          console.log("🛠 ZenStack generating...");
          try {
            execSync("npx zenstack generate --schema prisma/schema.zmodel", {
              stdio: "inherit",
              env: {
                ...process.env,
                DATABASE_URL: process.env.DATABASE_URL!,
              },
            });
            console.log("✅ ZenStack generation successful!");
          } catch (e) {
            console.error("❌ ZenStack generation failed", e);
            throw e;
          }
        },
      },
    ],
    external: ["@prisma/client", ".prisma/client"],
  },
});
