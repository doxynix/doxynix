import YAML from "yaml";

import { logger } from "../../infrastructure/logger";
import type { OpenApiInventory } from "../../types";

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

const HTTP_METHODS = new Set(["delete", "get", "head", "options", "patch", "post", "put"]);

export class OpenApiDiscoveryEngine {
  private static isLikelySpec(path: string, content: string): boolean {
    const ext = path.slice(((path.lastIndexOf(".") - 1) >>> 0) + 2).toLowerCase();

    if (IGNORED_EXTENSIONS.has(`.${ext}`)) return false;
    if (!["json", "yaml", "yml"].includes(ext)) return false;

    const sample = content.slice(0, 1000);
    return /["']?(openapi|swagger)["']?\s*:\s*/i.test(sample) && sample.includes("paths");
  }

  public static collect(files: { content: string; path: string }[]): OpenApiInventory {
    const inventory: OpenApiInventory = {
      estimatedOperations: 0,
      pathPatterns: [],
      sourceFiles: [],
    };

    const uniquePaths = new Set<string>();

    for (const file of files) {
      if (!this.isLikelySpec(file.path, file.content)) continue;

      try {
        const isJson = file.path.toLowerCase().endsWith(".json");
        const data = isJson ? JSON.parse(file.content) : YAML.parse(file.content);

        if (!data || typeof data !== "object" || !data.paths) continue;

        const specPaths = Object.keys(data.paths).filter((p) => p.startsWith("/"));
        if (specPaths.length === 0) continue;

        inventory.sourceFiles.push(file.path);
        specPaths.forEach((p) => uniquePaths.add(p));

        for (const pathKey of specPaths) {
          const methods = data.paths[pathKey];
          if (methods && typeof methods === "object") {
            inventory.estimatedOperations += Object.keys(methods).filter((m) =>
              HTTP_METHODS.has(m.toLowerCase())
            ).length;
          }
        }

        if (inventory.sourceFiles.length >= 20) break;
      } catch {
        if (file.path.includes("swagger") || file.path.includes("openapi")) {
          logger.debug({ msg: "Malformed OpenAPI spec ignored", path: file.path });
        }
      }
    }

    inventory.pathPatterns = Array.from(uniquePaths).sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" })
    );
    return inventory;
  }
}
