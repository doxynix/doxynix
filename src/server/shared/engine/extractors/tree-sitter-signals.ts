import "server-only";

import { logger } from "../../infrastructure/logger";
import type {
  FileSignals,
  RepositoryFile,
  RouteRef,
  SymbolKind,
  SymbolRef,
} from "../core/discovery.types";
import { collectFrameworkFactsFromTokens } from "../core/framework-catalog";

type LanguageSpec = {
  api?: RegExp[];
  declarations: Array<{ kind: SymbolKind; types: string[] }>;
  entrypoints: RegExp[];
  imports: { patterns: RegExp[]; types: string[] };
  routePatterns?: Array<{
    confidence?: number;
    framework?: string;
    methodIndex: number;
    pathIndex: number;
    pattern: RegExp;
  }>;
  wasm: string;
  wasmPackage?: string;
};

type FsDirentLike = {
  isDirectory(): boolean;
  name: string;
};

declare const process: { cwd(): string };

const fs = eval("require")("fs") as {
  existsSync(path: string): boolean;
  readdirSync(path: string, options: { withFileTypes: true }): FsDirentLike[];
};

const SPECS: Record<string, LanguageSpec> = {
  ".c": {
    declarations: [
      { kind: "function", types: ["function_definition"] },
      { kind: "struct", types: ["struct_specifier"] },
    ],
    entrypoints: [/\bint\s+main\s*\(/],
    imports: { patterns: [/^\s*#include\s+"([^"]+)"/m], types: ["preproc_include"] },
    wasm: "tree-sitter-c.wasm",
  },
  ".cpp": {
    declarations: [
      { kind: "function", types: ["function_definition"] },
      { kind: "class", types: ["class_specifier"] },
    ],
    entrypoints: [/\bint\s+main\s*\(/],
    imports: { patterns: [/^\s*#include\s+"([^"]+)"/m], types: ["preproc_include"] },
    wasm: "tree-sitter-cpp.wasm",
  },
  ".go": {
    declarations: [{ kind: "function", types: ["function_declaration", "method_declaration"] }],
    entrypoints: [/\bpackage\s+main\b[\s\S]*\bfunc\s+main\s*\(/],
    imports: { patterns: [/^\s*import\s+"([^"]+)"/m], types: ["import_declaration"] },
    routePatterns: [
      {
        framework: "Gin",
        methodIndex: 1,
        pathIndex: 2,
        pattern: /\brouter\.(GET|POST|PUT|PATCH|DELETE)\s*\(\s*"([^"]+)"/g,
      },
    ],
    wasm: "tree-sitter-go.wasm",
    wasmPackage: "tree-sitter-go",
  },
  ".js": {
    declarations: [
      { kind: "function", types: ["function_declaration"] },
      { kind: "class", types: ["class_declaration"] },
    ],
    entrypoints: [/\bapp\.listen\(/],
    imports: { patterns: [/from\s+["']([^"']+)["']/], types: ["import_statement"] },
    routePatterns: [
      {
        framework: "Express",
        methodIndex: 1,
        pathIndex: 2,
        pattern: /\.(get|post|put|patch|delete)\(\s*["']([^"']+)["']/g,
      },
    ],
    wasm: "tree-sitter-javascript.wasm",
  },
  ".py": {
    declarations: [
      { kind: "function", types: ["function_definition"] },
      { kind: "class", types: ["class_definition"] },
    ],
    entrypoints: [/if\s+__name__\s*==\s*["']__main__["']/],
    imports: {
      patterns: [/^\s*import\s+([\w.]+)/m, /^\s*from\s+([\w.]+)\s+import/m],
      types: ["import_statement", "import_from_statement"],
    },
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
    wasm: "tree-sitter-python.wasm",
    wasmPackage: "tree-sitter-python",
  },
  ".rs": {
    declarations: [
      { kind: "function", types: ["function_item"] },
      { kind: "struct", types: ["struct_item"] },
      { kind: "trait", types: ["trait_item"] },
    ],
    entrypoints: [/\bfn\s+main\s*\(/],
    imports: { patterns: [/^\s*use\s+([^;]+);/m], types: ["use_declaration"] },
    routePatterns: [
      {
        framework: "Axum",
        methodIndex: 1,
        pathIndex: 2,
        pattern: /#\[(get|post|put|patch|delete)\(\s*"([^"]+)"\s*\)\]/g,
      },
    ],
    wasm: "tree-sitter-rust.wasm",
  },
  ".ts": {
    declarations: [
      { kind: "function", types: ["function_declaration"] },
      { kind: "class", types: ["class_declaration"] },
    ],
    entrypoints: [/\bbootstrap\(\)/],
    imports: { patterns: [/from\s+["']([^"']+)["']/], types: ["import_statement"] },
    routePatterns: [
      {
        framework: "Hono",
        methodIndex: 1,
        pathIndex: 2,
        pattern: /\.(get|post|put|patch|delete)\(\s*["']([^"']+)["']/g,
      },
    ],
    wasm: "tree-sitter-typescript.wasm",
  },
};

export const TREE_SITTER_SUPPORTED_EXTENSIONS = Object.keys(SPECS);

let ParserRuntime: any;
let LanguageRuntime: any;
const languageCache = new Map<string, Promise<any>>();
let runtimeInitPromise: Promise<void> | null = null;
const smokeCheckedExtensions = new Set<string>();

function joinFsPath(...parts: string[]) {
  return parts.join("/").replace(/[\\/]+/g, "/");
}

async function initRuntime() {
  if (runtimeInitPromise != null) return await runtimeInitPromise;

  runtimeInitPromise = (async () => {
    const mod = await import("web-tree-sitter");
    const runtime = mod.default ?? mod;
    ParserRuntime = runtime.Parser ?? mod.Parser ?? runtime;
    LanguageRuntime = runtime.Language ?? mod.Language;

    if (ParserRuntime == null || typeof ParserRuntime.init !== "function") {
      throw new Error("web-tree-sitter Parser runtime is unavailable");
    }

    if (LanguageRuntime == null || typeof LanguageRuntime.load !== "function") {
      throw new Error("web-tree-sitter Language runtime is unavailable");
    }

    await ParserRuntime.init({
      locateFile: (name: string) =>
        joinFsPath(process.cwd(), "node_modules", "web-tree-sitter", name),
    });
  })().catch((error) => {
    runtimeInitPromise = null;
    throw error;
  });

  return await runtimeInitPromise;
}

async function loadLanguage(ext: string, spec: LanguageSpec) {
  if (!languageCache.has(ext)) {
    languageCache.set(
      ext,
      (async () => {
        await initRuntime();
        const wasmPath = resolveGrammarWasmPath(spec);
        const language = await LanguageRuntime.load(wasmPath);

        if (!smokeCheckedExtensions.has(ext) && (ext === ".go" || ext === ".py")) {
          smokeCheckedExtensions.add(ext);
          logger.info({
            ext,
            msg: "Tree-sitter language runtime loaded successfully",
            wasmPath: spec.wasm,
          });
        }

        return language;
      })().catch((error) => {
        languageCache.delete(ext);
        throw error;
      })
    );
  }

  return await languageCache.get(ext);
}

function resolveGrammarWasmPath(spec: LanguageSpec) {
  if (spec.wasmPackage != null) {
    const directGrammarPath = resolvePnpmPackageAsset(spec.wasmPackage, spec.wasm);
    if (directGrammarPath != null) {
      return directGrammarPath;
    }
  }

  return joinFsPath(process.cwd(), "node_modules", "tree-sitter-wasms", "out", spec.wasm);
}

function resolvePnpmPackageAsset(packageName: string, assetName: string) {
  const pnpmRoot = joinFsPath(process.cwd(), "node_modules", ".pnpm");
  if (!fs.existsSync(pnpmRoot)) return null;

  for (const entry of fs.readdirSync(pnpmRoot, { withFileTypes: true })) {
    if (!entry.isDirectory() || !entry.name.startsWith(`${packageName}@`)) {
      continue;
    }

    const candidate = joinFsPath(pnpmRoot, entry.name, "node_modules", packageName, assetName);
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

function lineOf(content: string, fragment: string) {
  const index = content.indexOf(fragment);
  if (index < 0) return undefined;
  return content.slice(0, index).split(/\r?\n/u).length;
}

function extractNodeName(nodeText: string) {
  const firstLine = nodeText.split(/\r?\n/u, 1)[0]?.trim() ?? "";
  return /([A-Za-z_][\w]*)/.exec(firstLine)?.[1];
}

function getFileExtension(filePath: string) {
  const normalized = filePath.replace(/\\/g, "/");
  const filename = normalized.slice(normalized.lastIndexOf("/") + 1);
  const dotIndex = filename.lastIndexOf(".");
  return dotIndex >= 0 ? filename.slice(dotIndex).toLowerCase() : "";
}

function collectRoutes(file: RepositoryFile, spec: LanguageSpec) {
  const routes: RouteRef[] = [];

  for (const routePattern of spec.routePatterns ?? []) {
    for (const match of file.content.matchAll(routePattern.pattern)) {
      const method =
        typeof match[routePattern.methodIndex] === "string"
          ? match[routePattern.methodIndex]?.toUpperCase()
          : undefined;
      const routePath =
        typeof match[routePattern.pathIndex] === "string"
          ? match[routePattern.pathIndex]
          : undefined;
      if (method == null || routePath == null) continue;
      routes.push({
        confidence: routePattern.confidence ?? 74,
        framework: routePattern.framework,
        kind: "http",
        line: lineOf(file.content, match[0]),
        method,
        path: routePath,
        sourcePath: file.path,
      });
    }
  }

  return routes;
}

export async function collectTreeSitterSignals(file: RepositoryFile): Promise<FileSignals | null> {
  const ext = getFileExtension(file.path);
  const spec = SPECS[ext];
  if (!spec) return null;

  try {
    const lang = await loadLanguage(ext, spec);
    const parser = new ParserRuntime();
    let tree: any;

    try {
      parser.setLanguage(lang);
      tree = parser.parse(file.content);
      const root = tree.rootNode;

      let apiSurface = 0;
      let exports = 0;
      const imports = new Set<string>();
      const symbols: SymbolRef[] = [];

      const declarationTypes = spec.declarations.flatMap((entry) => entry.types);
      const declarationKindByType = new Map(
        spec.declarations.flatMap((entry) => entry.types.map((type) => [type, entry.kind] as const))
      );

      const cursor = root.walk();
      let reachedRoot = false;
      while (!reachedRoot) {
        const nodeType = cursor.nodeType;
        const nodeText = cursor.nodeText;

        if (spec.imports.types.includes(nodeType)) {
          spec.imports.patterns.forEach((re) => {
            const match = nodeText.match(re);
            if (match?.[1]) imports.add(match[1]);
          });
        }

        if (declarationTypes.includes(nodeType)) {
          exports += 1;
          const kind = declarationKindByType.get(nodeType) ?? "function";
          const name = extractNodeName(nodeText);
          if (name != null) {
            symbols.push({
              confidence: 72,
              exported: true,
              kind,
              line: lineOf(file.content, nodeText),
              name,
              path: file.path,
            });
          }
        }

        if (spec.api?.some((re) => re.test(nodeText))) {
          apiSurface++;
        }

        if (cursor.gotoFirstChild()) continue;
        if (cursor.gotoNextSibling()) continue;

        let backtrack = true;
        while (backtrack) {
          if (!cursor.gotoParent()) {
            reachedRoot = true;
            backtrack = false;
          } else if (cursor.gotoNextSibling()) {
            backtrack = false;
          }
        }
      }

      const routes = collectRoutes(file, spec);
      const frameworkHints = collectFrameworkFactsFromTokens(
        [...imports, file.path, ...symbols.map((symbol) => symbol.name)],
        file.path,
        78
      );

      return {
        analysisMode: "tree-sitter",
        apiSurface: Math.max(apiSurface, routes.length),
        confidence: 80, // AST-based extraction has high confidence
        entrypointHint: spec.entrypoints.some((re) => re.test(file.content)),
        exports,
        frameworkHints,
        imports: Array.from(imports),
        path: file.path,
        routes,
        source: "extraction" as const,
        symbols,
      };
    } finally {
      tree?.delete?.();
      parser?.delete?.();
    }
  } catch (error) {
    logger.error({
      error,
      ext,
      msg: "Tree-sitter unavailable; falling back to non-AST analysis",
      path: file.path,
    });
    return null;
  }
}
