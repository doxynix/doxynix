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
          console.log("🛠 Generating Prisma and ZenStack/Zod files...");
          try {
            execSync("npx zenstack generate --schema prisma/schema.zmodel", {
              stdio: "inherit",
            });
            console.log("✅ Generation successful!");
          } catch (error) {
            console.error("❌ Generation failed:", error);
            throw error;
          }
        },
      },
    ],
    external: ["@prisma/client", ".prisma/client"],
  },
});
