import YAML from "yaml";

import { appLogger } from "@/server/core/app-logger";
import { getFileExtension } from "@/server/utils/path-operations";
import type { OpenApiInventory } from "@/server/utils/types";

const IGNORED_EXTENSIONS = new Set([
  ".cpp",
  ".go",
  ".h",
  ".java",
  ".js",
  ".jsx",
  ".kt",
  ".php",
  ".py",
  ".rb",
  ".rs",
  ".ts",
  ".tsx",
]);

type MinimalOpenApi = {
  paths: Record<string, Record<string, unknown>>;
};

const HTTP_METHODS = new Set(["delete", "get", "head", "options", "patch", "post", "put"]);

const MAX_SPEC_SIZE_BYTES = 5 * 1024 * 1024;

export class OpenApiDiscoveryEngine {
  public static collect(files: { content: string; path: string }[]): OpenApiInventory {
    const inventory: OpenApiInventory = {
      estimatedOperations: 0,
      pathPatterns: [],
      sourceFiles: [],
    };

    const uniquePaths = new Set<string>();

    for (const file of files) {
      if (file.content.length > MAX_SPEC_SIZE_BYTES) {
        appLogger.debug({
          msg: "File size exceeds limit for OpenAPI scanning, skipped",
          path: file.path,
        });
        continue;
      }

      if (!this.isLikelySpec(file.path, file.content)) continue;

      try {
        const isJson = file.path.toLowerCase().endsWith(".json");
        const rawData = isJson
          ? JSON.parse(file.content)
          : YAML.parse(file.content, { logLevel: "error", maxAliasCount: 0 });
        const data = rawData as MinimalOpenApi | null;

        if (data == null || typeof data !== "object") continue;

        const specPaths = Object.keys(data.paths).filter((p) => p.startsWith("/"));
        if (specPaths.length === 0) continue;

        inventory.sourceFiles.push(file.path);
        specPaths.forEach((p) => uniquePaths.add(p));

        for (const pathKey of specPaths) {
          const methods = data.paths[pathKey];
          if (methods != null && typeof methods === "object") {
            inventory.estimatedOperations += Object.keys(methods).filter((m) =>
              HTTP_METHODS.has(m.toLowerCase())
            ).length;
          }
        }

        if (inventory.sourceFiles.length >= 20) break;
      } catch {
        if (file.path.includes("swagger") || file.path.includes("openapi")) {
          appLogger.debug({ msg: "Malformed OpenAPI spec ignored", path: file.path });
        }
      }
    }

    inventory.pathPatterns = Array.from(uniquePaths).toSorted((a, b) =>
      a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" })
    );
    return inventory;
  }

  private static isLikelySpec(path: string, content: string): boolean {
    const ext = getFileExtension(path).toLowerCase();

    if (IGNORED_EXTENSIONS.has(`.${ext}`)) return false;
    if (!["json", "yaml", "yml"].includes(ext)) return false;

    const sample = content.slice(0, 1000);
    return /["']?(openapi|swagger)["']?\s*:\s*/i.test(sample) && sample.includes("paths");
  }
}
