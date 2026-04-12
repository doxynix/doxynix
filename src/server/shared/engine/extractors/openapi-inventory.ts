import pm from "picomatch";
import YAML from "yaml";

import { logger } from "../../infrastructure/logger";
import type { OpenApiInventory } from "../../types";
import { PATH_PATTERNS } from "../core/project-policy-rules";

const isSpecFile = pm([...PATH_PATTERNS.OPENAPI]);

type OpenApiLikeObject = {
  paths?: Record<string, unknown>;
};

function processSpecObject(data: unknown) {
  if (typeof data !== "object" || data == null) return null;
  const candidate = data as OpenApiLikeObject;
  if (typeof candidate.paths !== "object") return null;

  const paths = Object.keys(candidate.paths).filter((path) => path.startsWith("/"));
  let operations = 0;

  const methods = new Set(["delete", "get", "head", "options", "patch", "post", "put"]);
  for (const pathKey in candidate.paths) {
    const pathItem = candidate.paths[pathKey];
    if (typeof pathItem === "object" && pathItem != null) {
      operations += Object.keys(pathItem).filter((key) => methods.has(key.toLowerCase())).length;
    }
  }

  return { operations, paths };
}

export function collectOpenApiInventory(
  files: { content: string; path: string }[]
): OpenApiInventory {
  const sourceFiles: string[] = [];
  const pathPatterns = new Set<string>();
  let estimatedOperations = 0;

  for (const file of files) {
    const lowerPath = file.path.toLowerCase();

    if (!isSpecFile(lowerPath)) {
      const head = file.content.toLowerCase();
      const hasMarker = head.includes("openapi") || head.includes("swagger");
      if (!hasMarker) continue;
    }

    let specData: unknown = null;
    try {
      if (lowerPath.endsWith(".json")) {
        specData = JSON.parse(file.content);
      } else {
        specData = YAML.parse(file.content);
      }
    } catch (error) {
      logger.debug({
        error,
        msg: "OpenAPI inventory skipped malformed spec file",
        path: file.path,
      });
      continue;
    }

    const result = processSpecObject(specData);
    if (!result) continue;

    sourceFiles.push(file.path);
    result.paths.forEach((p) => pathPatterns.add(p));
    estimatedOperations += result.operations;

    if (sourceFiles.length >= 12) break;
  }

  return {
    estimatedOperations,
    pathPatterns: Array.from(pathPatterns).sort((left, right) => left.localeCompare(right)),
    sourceFiles,
  };
}
