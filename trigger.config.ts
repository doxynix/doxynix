import { additionalFiles } from "@trigger.dev/build/extensions/core";
import { prismaExtension } from "@trigger.dev/build/extensions/prisma";
import { defineConfig } from "@trigger.dev/sdk";

if (!process.env.DATABASE_URL!) {
  process.env.DATABASE_URL = "postgresql://postgres:password@localhost:5432/db";
}

export default defineConfig({
  build: {
    extensions: [
      additionalFiles({
        files: [
          "node_modules/web-tree-sitter/tree-sitter.wasm",
          "node_modules/tree-sitter-wasms/out/*.wasm",
        ],
      }),
      {
        name: "zenstack-generate",
        onBuildStart: async () => {
          console.log("ZenStack generating...");
          // try {
          //   // eslint-disable-next-line sonarjs/no-os-command-from-path
          //   execSync("pnpm zenstack generate --schema prisma/schema.zmodel", {
          //     env: { ...process.env },
          //     stdio: "inherit",
          //   });

          //   const schemaPath = "prisma/schema.prisma";
          //   if (fs.existsSync(schemaPath)) {
          //     console.log("Stripping extra generators from schema.prisma...");
          //     let content = fs.readFileSync(schemaPath, "utf-8");

          //     content = content.replaceAll(/generator\s+(?!client)\w+\s+{[^}]+}/g, "");

          //     fs.writeFileSync(schemaPath, content);
          //     console.log("Schema cleaned up for cloud build");
          //   }
          // } catch (error) {
          //   console.error("❌ ZenStack generation failed", error);
          //   throw error;
          // }
        },
      },
      prismaExtension({
        mode: "legacy",
        schema: "prisma/schema.prisma",
        typedSql: true,
      }),
    ],
    external: [
      "ioredis",
      "bottleneck",
      "web-tree-sitter",
      "jscpd",
      "@jscpd/core",
      "@jscpd/finder",
      "@jscpd/tokenizer",
      "colors",
    ],
  },
  dirs: ["./src/server/**/tasks"],
  logLevel: "log",
  maxDuration: 1_000_000,

  project: "proj_whmkduzdqfzcgoyuhdyp",
  runtime: "node-22",
});
