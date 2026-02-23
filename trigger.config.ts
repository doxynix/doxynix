import { execSync } from "node:child_process";
import fs from "node:fs";
import { prismaExtension } from "@trigger.dev/build/extensions/prisma";
import { defineConfig } from "@trigger.dev/sdk/v3";

if (!process.env.DATABASE_URL!) {
  process.env.DATABASE_URL = "postgresql://postgres:password@localhost:5432/db";
}

export default defineConfig({
  build: {
    extensions: [
      {
        name: "zenstack-generate",
        onBuildStart: async () => {
          console.log("🛠 ZenStack generating...");
          try {
            // eslint-disable-next-line sonarjs/no-os-command-from-path
            execSync("npx zenstack generate --schema prisma/schema.zmodel", {
              env: { ...process.env },
              stdio: "inherit",
            });

            const schemaPath = "prisma/schema.prisma";
            if (fs.existsSync(schemaPath)) {
              console.log("🧹 Stripping extra generators from schema.prisma...");
              let content = fs.readFileSync(schemaPath, "utf-8");

              content = content.replace(/generator\s+(?!client)\w+\s+\{[^}]+\}/g, "");

              fs.writeFileSync(schemaPath, content);
              console.log("✅ Schema cleaned up for cloud build");
            }
          } catch (e) {
            console.error("❌ ZenStack generation failed", e);
            throw e;
          }
        },
      },
      prismaExtension({
        mode: "legacy",
        schema: "prisma/schema.prisma",
      }),
    ],
  },
  dirs: ["./src/trigger"],
  logLevel: "log",
  maxDuration: 1000000,

  project: "proj_whmkduzdqfzcgoyuhdyp",
  runtime: "node",
});
