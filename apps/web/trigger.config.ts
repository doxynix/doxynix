import { execSync } from "node:child_process";
import fs from "node:fs";

import { additionalFiles, additionalPackages } from "@trigger.dev/build/extensions/core";
import { prismaExtension } from "@trigger.dev/build/extensions/prisma";
import { defineConfig, type TriggerConfig } from "@trigger.dev/sdk";
import { join } from "pathe";

if (!process.env.DATABASE_URL!) {
  process.env.DATABASE_URL = "postgresql://postgres:password@localhost:5432/db";
}

if (!process.env.DIRECT_URL) {
  // prisma.config.ts requires DIRECT_URL at config load; generation never connects, so a local fallback is fine.
  process.env.DIRECT_URL = "postgresql://postgres:password@localhost:5432/db";
}

type PackageJson = {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  patchedDependencies?: Record<string, string>;
  workspaces?: unknown;
};

const RUNTIME: NonNullable<TriggerConfig["runtime"]> = "bun";

function sanitizeDeployPackageJson(packageJson: PackageJson) {
  delete packageJson.patchedDependencies;
  delete packageJson.workspaces;

  for (const field of ["dependencies", "devDependencies", "optionalDependencies"] as const) {
    const dependencies = packageJson[field];

    if (dependencies == null) {
      continue;
    }

    for (const [name, version] of Object.entries(dependencies)) {
      if (version.startsWith("workspace:")) {
        delete dependencies[name];
      }
    }
  }
}

function patchPackageJsonForBun(path: string) {
  if (!fs.existsSync(path)) {
    return;
  }

  const packageJson = JSON.parse(fs.readFileSync(path, "utf8")) as PackageJson;
  sanitizeDeployPackageJson(packageJson);
  fs.writeFileSync(path, `${JSON.stringify(packageJson, null, 2)}\n`);
}

export default defineConfig({
  build: {
    extensions: [
      {
        name: "bun-workspace-install",
        onBuildStart: (context) => {
          if (context.target === "dev" || !RUNTIME.startsWith("bun")) {
            return;
          }

          // Trigger copies the project package.json into the Bun image before `bun install`;
          // Bun validates workspaces and patched dependencies that are absent from the bundle.
          patchPackageJsonForBun(join(process.cwd(), "package.json"));
          patchPackageJsonForBun(join(process.cwd(), "..", "..", "package.json"));
        },
      },
      additionalFiles({
        files: [
          "node_modules/web-tree-sitter/tree-sitter.wasm",
          "node_modules/tree-sitter-wasms/out/*.wasm",
        ],
      }),
      additionalPackages({
        packages: ["web-tree-sitter"],
      }),
      {
        name: "zenstack-generate",
        onBuildStart: async () => {
          console.log("ZenStack generating...");
          try {
            execSync("bun zenstack generate --schema prisma/schema.zmodel", {
              env: { ...process.env },
              stdio: "inherit",
            });

            const schemaPath = "prisma/schema.prisma";
            if (fs.existsSync(schemaPath)) {
              console.log("Stripping extra generators from schema.prisma...");
              let content = fs.readFileSync(schemaPath, "utf-8");

              content = content.replaceAll(/generator\s+(?!client)\w+\s+{[^}]+}/g, "");

              fs.writeFileSync(schemaPath, content);
              console.log("Schema cleaned up for cloud build");
            }
          } catch (error) {
            console.error("❌ ZenStack generation failed", error);
            throw error;
          }
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
  // TODO(DXNX-290): switch to "bun-1.4" once Trigger 4.8.2 ships.
  runtime: RUNTIME,
});
