import type { RepositoryFile, RouteRef, SymbolKind } from "../core/discovery.types";

const ONE_C_PROCEDURE = "\\u041F\\u0440\\u043E\\u0446\\u0435\\u0434\\u0443\\u0440\\u0430";
const ONE_C_FUNCTION = "\\u0424\\u0443\\u043D\\u043A\\u0446\\u0438\\u044F";
const ONE_C_EXPORT = "\\u042D\\u043A\\u0441\\u043F\\u043E\\u0440\\u0442";
const ONE_C_EXPORTED_MEMBER_REGEX = new RegExp(
  `\\b(?:${ONE_C_PROCEDURE}|${ONE_C_FUNCTION})\\b.*\\b${ONE_C_EXPORT}\\b`,
  "giu"
);

export type RegexRoutePattern = Pick<RouteRef, "framework"> & {
  confidence?: number;
  methodIndex: number;
  pathIndex: number;
  pattern: RegExp;
};

export type RegexSymbolPattern = {
  exported?: boolean;
  kind: SymbolKind;
  pattern: RegExp;
};

export type RegexSignalSpec = {
  apiSurfacePatterns: RegExp[];
  entrypointHint: (file: RepositoryFile) => boolean;
  exportPatterns: RegExp[];
  extraFrameworkTokens?: (file: RepositoryFile) => string[];
  importPatterns: RegExp[];
  routePatterns?: RegexRoutePattern[];
  symbolPatterns: RegexSymbolPattern[];
};

const DEFAULT_SIGNAL_SPEC: RegexSignalSpec = {
  apiSurfacePatterns: [],
  entrypointHint: () => false,
  exportPatterns: [
    /^\s*(?:public|export|pub)\s+/gm,
    /^\s*(?:function|class|interface|module|procedure|func|proc)\s+/gim,
  ],
  importPatterns: [
    /^\s*import\s+([\w./-]+)/gm,
    /^\s*from\s+([\w./-]+)\s+import\b/gm,
    /^\s*use\s+([\w./-]+)/gm,
    /^\s*include\s+["']([^"']+)["']/gm,
  ],
  symbolPatterns: [
    {
      exported: true,
      kind: "function",
      pattern: /^\s*(?:function|func|proc|procedure)\s+([_a-z]\w*)/gim,
    },
    { exported: true, kind: "class", pattern: /^\s*class\s+([A-Z_a-z]\w*)/gm },
    { exported: true, kind: "interface", pattern: /^\s*interface\s+([A-Z_a-z]\w*)/gm },
  ],
};

const REGEX_SIGNAL_SPECS: Record<string, RegexSignalSpec> = {
  "1c": {
    apiSurfacePatterns: [ONE_C_EXPORTED_MEMBER_REGEX],
    entrypointHint: (file) =>
      /managedapplicationmodule|ordinaryapplicationmodule|sessionmodule|externconnectionmodule/i.test(
        file.path
      ),
    exportPatterns: [ONE_C_EXPORTED_MEMBER_REGEX],
    extraFrameworkTokens: () => ["1C:Enterprise"],
    importPatterns: [],
    symbolPatterns: [
      {
        exported: true,
        kind: "function",
        pattern: new RegExp(
          `\\b(?:${ONE_C_PROCEDURE}|${ONE_C_FUNCTION})\\s+([\\p{L}_][\\p{L}\\p{N}_]*)`,
          "giu"
        ),
      },
    ],
  },
  ".cs": {
    apiSurfacePatterns: [
      /\bMap(Get|Post|Put|Delete|Patch)\s*\(/g,
      /\[Http(Get|Post|Put|Delete|Patch)/g,
    ],
    entrypointHint: (file) =>
      /\bstatic\s+void\s+Main\s*\(/.test(file.content) ||
      /\bWebApplication\.CreateBuilder\s*\(/.test(file.content),
    exportPatterns: [
      /\bpublic\s+(?:class|interface|enum|record|struct)\b/g,
      /\bpublic\s+[\w,<>?[\]]+\s+[A-Z_a-z]\w*\s*\(/g,
    ],
    importPatterns: [/^\s*using\s+([\w.]+)\s*;$/gm],
    routePatterns: [
      {
        framework: "ASP.NET Core",
        methodIndex: 1,
        pathIndex: 2,
        pattern: /\bMap(Get|Post|Put|Delete|Patch)\s*\(\s*"([^"]+)"/g,
      },
    ],
    symbolPatterns: [
      { exported: true, kind: "class", pattern: /\bpublic\s+class\s+([A-Z_a-z]\w*)\b/g },
      { exported: true, kind: "interface", pattern: /\bpublic\s+interface\s+([A-Z_a-z]\w*)\b/g },
    ],
  },
  ".dart": {
    apiSurfacePatterns: [/@(?:GET|POST|PUT|PATCH|DELETE)\b/g],
    entrypointHint: (file) => /\bvoid\s+main\s*\(/.test(file.content),
    exportPatterns: [
      /^\s*class\s+[A-Z]\w*/gm,
      /^\s*(?:Future<[^>]+>\s+)?[A-Z_a-z][\w<>?]*\s+[A-Z_a-z]\w*\s*\(/gm,
    ],
    importPatterns: [/^\s*import\s+["']([^"']+)["']/gm],
    symbolPatterns: [
      { exported: true, kind: "class", pattern: /^\s*class\s+([A-Z]\w*)/gm },
      {
        exported: true,
        kind: "function",
        pattern: /^\s*(?:Future<[^>]+>\s+)?[A-Z_a-z][\w<>?]*\s+([A-Z_a-z]\w*)\s*\(/gm,
      },
    ],
  },
  ".go": {
    apiSurfacePatterns: [
      /\bHandleFunc\s*\(/g,
      /\b(GET|POST|PUT|PATCH|DELETE)\s*\(/g,
      /\brouter\.(GET|POST|PUT|PATCH|DELETE)\s*\(/g,
    ],
    entrypointHint: (file) =>
      /\bpackage\s+main\b/.test(file.content) && /\bfunc\s+main\s*\(/.test(file.content),
    exportPatterns: [
      /^func\s*(?:\([^)]*\)\s*)?[A-Z]\w*\s*\(/gm,
      /^(?:type|const|var)\s+[A-Z]\w*\b/gm,
    ],
    importPatterns: [/^\s*import\s+"([^"]+)"/gm, /^\s*"([^"]+)"\s*$/gm],
    routePatterns: [
      {
        framework: "Gin",
        methodIndex: 1,
        pathIndex: 2,
        pattern: /\brouter\.(GET|POST|PUT|PATCH|DELETE)\s*\(\s*"([^"]+)"/g,
      },
    ],
    symbolPatterns: [
      {
        exported: true,
        kind: "function",
        pattern: /^func\s*(?:\([^)]*\)\s*)?([A-Z]\w*)\s*\(/gm,
      },
      { exported: true, kind: "struct", pattern: /^type\s+([A-Z]\w*)\s+struct\b/gm },
    ],
  },
  ".java": {
    apiSurfacePatterns: [/@(Get|Post|Put|Delete|Patch|Request)Mapping\b/g, /\brouting\s*{/g],
    entrypointHint: (file) =>
      /\bpublic\s+static\s+void\s+main\s*\(/.test(file.content) ||
      /\bfun\s+main\s*\(/.test(file.content),
    exportPatterns: [
      /\bpublic\s+(?:class|interface|enum|record)\b/g,
      /\bpublic\s+[\w,<>?[\]]+\s+[A-Z_a-z]\w*\s*\(/g,
      /^\s*(?:class|object|interface|fun)\s+[A-Z]\w*/gm,
    ],
    importPatterns: [/^\s*import\s+([\w*.]+)\s*;?$/gm],
    routePatterns: [
      {
        framework: "Spring Boot",
        methodIndex: 1,
        pathIndex: 2,
        pattern: /@(Get|Post|Put|Delete|Patch)Mapping\(\s*["']([^"']+)["']/g,
      },
    ],
    symbolPatterns: [
      { exported: true, kind: "class", pattern: /\bpublic\s+class\s+([A-Z_a-z]\w*)\b/g },
      { exported: true, kind: "interface", pattern: /\bpublic\s+interface\s+([A-Z_a-z]\w*)\b/g },
    ],
  },
  ".php": {
    apiSurfacePatterns: [/\broute::(get|post|put|patch|delete)\b/gi, /#\[Route\(/g],
    entrypointHint: (file) => getFileName(file.path).toLowerCase() === "index.php",
    exportPatterns: [/\bpublic\s+function\b/g, /\bclass\s+[A-Z]\w*\b/g],
    importPatterns: [
      /^\s*use\s+([^;]+);$/gm,
      /\b(?:require|include)(?:_once)?\s*\(?\s*["']([^"']+)["']/g,
    ],
    routePatterns: [
      {
        framework: "Laravel",
        methodIndex: 1,
        pathIndex: 2,
        pattern: /\broute::(get|post|put|patch|delete)\s*\(\s*["']([^"']+)["']/gi,
      },
    ],
    symbolPatterns: [
      { exported: true, kind: "class", pattern: /\bclass\s+([A-Z]\w*)\b/g },
      { exported: true, kind: "function", pattern: /\bfunction\s+([A-Z_a-z]\w*)\s*\(/g },
    ],
  },
  ".py": {
    apiSurfacePatterns: [
      /@\w*router\.(get|post|put|patch|delete)\(/g,
      /@app\.(get|post|put|patch|delete)\(/g,
      /\badd_api_route\(/g,
    ],
    entrypointHint: (file) => /if\s+__name__\s*==\s*["']__main__["']/.test(file.content),
    exportPatterns: [
      /^(?:async\s+)?def\s+(?!_)[A-Z_a-z]\w*\s*\(/gm,
      /^class\s+(?!_)[A-Z_a-z]\w*\b/gm,
    ],
    extraFrameworkTokens: (file) => [
      ...((file.content.match(/\b(FastAPI|APIRouter|Flask|Django)\b/g) ?? []) as string[]),
    ],
    importPatterns: [
      /^\s*import\s+([A-Z_a-z][\w.]*)/gm,
      /^\s*from\s+([.A-Z_a-z][\w.]*)\s+import\b/gm,
    ],
    routePatterns: [
      {
        framework: "FastAPI",
        methodIndex: 1,
        pathIndex: 2,
        pattern: /@\w*router\.(get|post|put|patch|delete)\(\s*["']([^"']+)["']/g,
      },
      {
        framework: "FastAPI",
        methodIndex: 1,
        pathIndex: 2,
        pattern: /@app\.(get|post|put|patch|delete)\(\s*["']([^"']+)["']/g,
      },
    ],
    symbolPatterns: [
      { exported: true, kind: "function", pattern: /^(?:async\s+)?def\s+([A-Z_a-z]\w*)\s*\(/gm },
      { exported: true, kind: "class", pattern: /^class\s+([A-Z_a-z]\w*)\b/gm },
    ],
  },
  ".rb": {
    apiSurfacePatterns: [
      /^\s*(get|post|put|patch|delete)\s+["']/gm,
      /\bresources\s+:[A-Z_a-z]\w*/g,
    ],
    entrypointHint: (file) =>
      /\b(run|start)\b/.test(getFileName(file.path).toLowerCase()) ||
      file.path.endsWith("config.ru"),
    exportPatterns: [
      /^\s*class\s+[A-Z][\w:]*/gm,
      /^\s*module\s+[A-Z][\w:]*/gm,
      /^\s*def\s+[A-Z_a-z][\w!=?]*/gm,
    ],
    importPatterns: [
      /^\s*require_relative\s+["']([^"']+)["']/gm,
      /^\s*require\s+["']([^"']+)["']/gm,
    ],
    routePatterns: [
      {
        framework: "Ruby Router",
        methodIndex: 1,
        pathIndex: 2,
        pattern: /^\s*(get|post|put|patch|delete)\s+["']([^"']+)["']/gm,
      },
    ],
    symbolPatterns: [
      { exported: true, kind: "class", pattern: /^\s*class\s+([A-Z][\w:]*)/gm },
      { exported: true, kind: "module", pattern: /^\s*module\s+([A-Z][\w:]*)/gm },
      { exported: true, kind: "function", pattern: /^\s*def\s+([A-Z_a-z][\w!=?]*)/gm },
    ],
  },
  ".rs": {
    apiSurfacePatterns: [/#\[(get|post|put|patch|delete)]/g, /\bRouter::new\s*\(/g],
    entrypointHint: (file) => /\bfn\s+main\s*\(/.test(file.content),
    exportPatterns: [/\bpub\s+(?:fn|struct|enum|trait|mod|const|type)\b/g],
    importPatterns: [/^\s*use\s+([^;]+);$/gm, /^\s*mod\s+([A-Z_a-z]\w*)\s*;$/gm],
    routePatterns: [
      {
        framework: "Axum",
        methodIndex: 1,
        pathIndex: 2,
        pattern: /#\[(get|post|put|patch|delete)\(\s*"([^"]+)"\s*\)]/g,
      },
    ],
    symbolPatterns: [
      { exported: true, kind: "function", pattern: /\bpub\s+fn\s+([A-Z_a-z]\w*)\s*\(/g },
      { exported: true, kind: "struct", pattern: /\bpub\s+struct\s+([A-Z_a-z]\w*)\b/g },
      { exported: true, kind: "trait", pattern: /\bpub\s+trait\s+([A-Z_a-z]\w*)\b/g },
    ],
  },
  ".scala": {
    apiSurfacePatterns: [],
    entrypointHint: (file) =>
      /\bdef\s+main\s*\(/.test(file.content) || /\bextends\s+App\b/.test(file.content),
    exportPatterns: [/^\s*(?:object|class|trait)\s+[A-Z]\w*/gm],
    importPatterns: [/^\s*import\s+([\s\w*,.{}]+)/gm],
    symbolPatterns: [
      { exported: true, kind: "class", pattern: /^\s*class\s+([A-Z]\w*)/gm },
      { exported: true, kind: "trait", pattern: /^\s*trait\s+([A-Z]\w*)/gm },
      { exported: true, kind: "module", pattern: /^\s*object\s+([A-Z]\w*)/gm },
    ],
  },
  ".swift": {
    apiSurfacePatterns: [/@main/g],
    entrypointHint: (file) => /@main/.test(file.content),
    exportPatterns: [/\b(?:public|open)\s+(?:class|struct|enum|protocol|func)\b/g],
    importPatterns: [/^\s*import\s+([\w.]+)/gm],
    symbolPatterns: [
      { exported: true, kind: "class", pattern: /\b(?:public|open)\s+class\s+([A-Z_a-z]\w*)\b/g },
      {
        exported: true,
        kind: "struct",
        pattern: /\b(?:public|open)\s+struct\s+([A-Z_a-z]\w*)\b/g,
      },
      {
        exported: true,
        kind: "function",
        pattern: /\b(?:public|open)\s+func\s+([A-Z_a-z]\w*)\s*\(/g,
      },
    ],
  },
  "c-family": {
    apiSurfacePatterns: [],
    entrypointHint: (file) => /\bint\s+main\s*\(/.test(file.content),
    exportPatterns: [/^[A-Z_a-z][\s\w*]*\s+([A-Z_a-z]\w*)\s*\([^;]*\)\s*{/gm],
    importPatterns: [/^\s*#include\s+"([^"]+)"/gm],
    symbolPatterns: [
      {
        exported: true,
        kind: "function",
        pattern: /^[A-Z_a-z][\s\w*]*\s+([A-Z_a-z]\w*)\s*\([^;]*\)\s*{/gm,
      },
    ],
  },
  elixir: {
    apiSurfacePatterns: [/\b(get|post|put|patch|delete)\s+["']/g],
    entrypointHint: (file) =>
      /\bdefmodule\b/.test(file.content) && file.path.endsWith("application.ex"),
    exportPatterns: [/^\s*def(module|p)?\s+[A-Z_a-z][\w!?]*/gm],
    importPatterns: [/^\s*(?:use|import|alias)\s+([\w.]+)/gm],
    routePatterns: [
      {
        framework: "Phoenix",
        methodIndex: 1,
        pathIndex: 2,
        pattern: /\b(get|post|put|patch|delete)\s+"([^"]+)"/g,
      },
    ],
    symbolPatterns: [
      { exported: true, kind: "module", pattern: /^\s*defmodule\s+([.A-Z_a-z][\w.]*)/gm },
      { exported: true, kind: "function", pattern: /^\s*defp?\s+([A-Z_a-z][\w!?]*)/gm },
    ],
  },
};

const SPEC_ALIASES: Record<string, string> = {
  ".bsl": "1c",
  ".cc": "c-family",
  ".cpp": "c-family",
  ".ex": "elixir",
  ".exs": "elixir",
  ".h": "c-family",
  ".hpp": "c-family",
  ".kt": ".java",
  ".kts": ".java",
  ".os": "1c",
};

function getFileExtension(filePath: string) {
  const normalizedPath = filePath.replaceAll("\\", "/");
  const filename = normalizedPath.slice(normalizedPath.lastIndexOf("/") + 1);
  const dotIndex = filename.lastIndexOf(".");
  return dotIndex >= 0 ? filename.slice(dotIndex).toLowerCase() : "";
}

function getFileName(filePath: string) {
  const normalizedPath = filePath.replaceAll("\\", "/");
  return normalizedPath.slice(normalizedPath.lastIndexOf("/") + 1);
}

export function getRegexSignalSpec(file: RepositoryFile): RegexSignalSpec {
  const extension = getFileExtension(file.path);
  const specKey = SPEC_ALIASES[extension] ?? extension;
  return REGEX_SIGNAL_SPECS[specKey] ?? DEFAULT_SIGNAL_SPEC;
}
