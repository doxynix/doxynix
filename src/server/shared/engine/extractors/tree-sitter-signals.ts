import "server-only";

import fs from "node:fs";
import { resolve } from "pathe";

import { logger } from "../../infrastructure/logger";
import { getFileExtension } from "../../lib/path-operations";
import type {
  FileSignals,
  RepositoryFile,
  RouteRef,
  SymbolKind,
  SymbolRef,
} from "../core/discovery.types";
import { collectFrameworkFactsFromTokens } from "../core/framework-catalog";
import { CONFIDENCE_LEVELS } from "../core/scoring-constants";

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

declare const process: { cwd(): string };

const SPECS: Record<string, LanguageSpec> = {
  ".c": {
    declarations: [
      { kind: "function", types: ["function_definition"] },
      { kind: "struct", types: ["struct_specifier", "type_definition"] },
    ],
    entrypoints: [/\bint\s+main\s*\(/],
    imports: { patterns: [/^\s*#include\s+"([^"]+)"/m], types: ["preproc_include"] },
    wasm: "tree-sitter-c.wasm",
  },
  ".cpp": {
    declarations: [
      { kind: "function", types: ["function_definition", "template_declaration"] },
      { kind: "class", types: ["class_specifier", "namespace_definition"] },
    ],
    entrypoints: [/\bint\s+main\s*\(/],
    imports: { patterns: [/^\s*#include\s+"([^"]+)"/m], types: ["preproc_include"] },
    wasm: "tree-sitter-cpp.wasm",
  },
  ".cs": {
    declarations: [
      {
        kind: "class",
        types: ["class_declaration", "interface_declaration", "struct_declaration"],
      },
      { kind: "method", types: ["method_declaration"] },
    ],
    entrypoints: [/\bstatic\s+void\s+Main\b/, /\bWebApplication\.CreateBuilder\b/],
    imports: { patterns: [/^using\s+([\w.]+);/m], types: ["using_directive"] },
    wasm: "tree-sitter-c-sharp.wasm",
  },
  ".erl": {
    declarations: [{ kind: "function", types: ["function", "export_attribute"] }],
    entrypoints: [/-export\s*\(\s*\[\s*main/],
    imports: { patterns: [/-include\s*\(\s*["']([^"']+)["']\s*\)/g], types: ["pp_directive"] },
    wasm: "tree-sitter-erlang.wasm",
  },
  ".go": {
    declarations: [
      { kind: "function", types: ["function_declaration", "method_declaration"] },
      { kind: "interface", types: ["interface_type"] },
      { kind: "struct", types: ["type_declaration", "struct_type"] },
    ],
    entrypoints: [/\bpackage\s+main\b[\S\s]*\bfunc\s+main\s*\(/],
    imports: {
      patterns: [/^\s*import\s+"([^"]+)"/m],
      types: ["import_declaration", "import_spec"],
    },
    routePatterns: [
      {
        framework: "Gin",
        methodIndex: 1,
        pathIndex: 2,
        pattern: /\.(GET|POST|PUT|PATCH|DELETE)\s*\(\s*"([^"]+)"/g,
      },
      {
        framework: "Echo",
        methodIndex: 1,
        pathIndex: 2,
        pattern: /\.(Add|GET|POST|PUT|PATCH|DELETE)\s*\(\s*"([^"]+)"/g,
      },
    ],
    wasm: "tree-sitter-go.wasm",
    wasmPackage: "tree-sitter-go",
  },
  ".java": {
    declarations: [
      { kind: "class", types: ["class_declaration", "interface_declaration", "enum_declaration"] },
      { kind: "method", types: ["method_declaration"] },
    ],
    entrypoints: [/\bpublic\s+static\s+void\s+main\b/],
    imports: { patterns: [/^import\s+([\w.]+);/m], types: ["import_declaration"] },
    routePatterns: [
      {
        framework: "Spring",
        methodIndex: 1,
        pathIndex: 2,
        pattern: /@(Get|Post|Put|Delete)Mapping\(\s*["']([^"']+)["']/g,
      },
    ],
    wasm: "tree-sitter-java.wasm",
  },
  ".jl": {
    declarations: [
      { kind: "function", types: ["function_definition"] },
      { kind: "struct", types: ["struct_definition"] },
    ],
    entrypoints: [/\bmain\s*\(|Base\.run/],
    imports: {
      patterns: [/using\s+([\w ,]+)/m, /import\s+([\w ,]+)/m],
      types: ["using_statement", "import_statement"],
    },
    wasm: "tree-sitter-julia.wasm",
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
  ".kt": {
    declarations: [
      {
        kind: "class",
        types: ["class_declaration", "object_declaration", "interface_declaration"],
      },
      { kind: "function", types: ["function_declaration"] },
    ],
    entrypoints: [/\bval\s+app\b/, /\bfun\s+main\b/],
    imports: { patterns: [/^import\s+([\w.]+)/m], types: ["import_header"] },
    wasm: "tree-sitter-kotlin.wasm",
  },
  ".lua": {
    declarations: [{ kind: "function", types: ["function_definition", "local_function"] }],
    entrypoints: [/\bmain\s*\(/],
    imports: { patterns: [/\brequire\s*\(?\s*["']([^"']+)["']\s*\)?/g], types: ["function_call"] },
    wasm: "tree-sitter-lua.wasm",
  },
  ".m": {
    declarations: [
      { kind: "method", types: ["method_definition"] },
      { kind: "class", types: ["class_interface", "category_interface"] },
    ],
    entrypoints: [/main\s*\(|NSApplicationMain/],
    imports: { patterns: [/#import\s+["<]([^">]+)[">]/m], types: ["preproc_import"] },
    wasm: "tree-sitter-objc.wasm",
  },
  ".php": {
    declarations: [
      { kind: "function", types: ["function_definition"] },
      { kind: "class", types: ["class_declaration", "interface_declaration", "trait_declaration"] },
    ],
    entrypoints: [/Route::(get|post|put|patch|delete)/, /\$app->(get|post|put|patch|delete)/],
    imports: { patterns: [/use\s+([\w\\]+);/m], types: ["use_declaration", "include_expression"] },
    routePatterns: [
      {
        framework: "Laravel",
        methodIndex: 1,
        pathIndex: 2,
        pattern: /route::(get|post|put|patch|delete)\(\s*["']([^"']+)["']/gi,
      },
    ],
    wasm: "tree-sitter-php.wasm",
  },
  ".py": {
    declarations: [
      { kind: "function", types: ["function_definition", "decorated_definition"] },
      { kind: "class", types: ["class_definition"] },
    ],
    entrypoints: [/if\s+__name__\s*==\s*["']__main__["']/, /app\s*=\s*(FastAPI|Flask|Django)/],
    imports: {
      patterns: [/^\s*import\s+([\w.]+)/m, /^\s*from\s+([\w.]+)\s+import/m],
      types: ["import_statement", "import_from_statement"],
    },
    routePatterns: [
      {
        framework: "FastAPI/Flask",
        methodIndex: 1,
        pathIndex: 2,
        pattern: /@\w*\.(get|post|put|patch|delete)\(\s*["']([^"']+)["']/g,
      },
      {
        framework: "Django",
        methodIndex: 0,
        pathIndex: 1,
        pattern: /path\(\s*["']([^"']+)["']\s*,\s*(\w+)/g,
      },
    ],
    wasm: "tree-sitter-python.wasm",
    wasmPackage: "tree-sitter-python",
  },
  ".rb": {
    declarations: [
      { kind: "class", types: ["class", "module"] },
      { kind: "function", types: ["method"] },
    ],
    entrypoints: [/config\.ru/, /bin\/rails/],
    imports: { patterns: [/require\s+["']([^"']+)["']/m], types: ["require"] },
    wasm: "tree-sitter-ruby.wasm",
  },
  ".rs": {
    declarations: [
      { kind: "function", types: ["function_item"] },
      { kind: "struct", types: ["struct_item", "enum_item", "union_item"] },
      { kind: "trait", types: ["trait_item", "impl_item"] },
      { kind: "module", types: ["mod_item"] },
    ],
    entrypoints: [/\bfn\s+main\s*\(/, /#\[tokio::main]/, /#\[actix_web::main]/],
    imports: { patterns: [/^\s*use\s+([^;]+);/m], types: ["use_declaration"] },
    routePatterns: [
      {
        framework: "Axum/Actix",
        methodIndex: 1,
        pathIndex: 2,
        pattern: /#\[(get|post|put|patch|delete)\(\s*"([^"]+)"\s*\)]/g,
      },
    ],
    wasm: "tree-sitter-rust.wasm",
  },
  ".sh": {
    declarations: [{ kind: "function", types: ["function_definition"] }],
    entrypoints: [/^#!\//],
    imports: { patterns: [/\bsource\s+([\w./-]+)/m, /^\.\s+([\w./-]+)/m], types: ["command"] },
    wasm: "tree-sitter-bash.wasm",
  },
  ".swift": {
    declarations: [
      { kind: "class", types: ["class_declaration", "struct_declaration", "enum_declaration"] },
      { kind: "function", types: ["function_declaration"] },
    ],
    entrypoints: [/@main/],
    imports: { patterns: [/^import\s+(\w+)/m], types: ["import_declaration"] },
    wasm: "tree-sitter-swift.wasm",
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
let runtimeInitPromise: null | Promise<void> = null;
const smokeCheckedExtensions = new Set<string>();

export async function initRuntime() {
  if (runtimeInitPromise != null) return await runtimeInitPromise;

  runtimeInitPromise = (async () => {
    // @ts-expect-error: web-tree-sitter entry point lacks type declarations
    const mod = await import("web-tree-sitter/web-tree-sitter.cjs");
    const Parser = mod.default ?? mod.Parser ?? mod;

    const cloudWasm = resolve(process.cwd(), "web-tree-sitter.wasm");
    const localWasm = resolve(process.cwd(), "node_modules/web-tree-sitter/web-tree-sitter.wasm");

    const finalWasmPath = fs.existsSync(cloudWasm) ? cloudWasm : localWasm;

    await (Parser as any).init({
      locateFile: (name: string) => {
        if (name === "tree-sitter.wasm" || name === "web-tree-sitter.wasm") {
          return finalWasmPath;
        }
        return name;
      },
    });

    ParserRuntime = Parser;
    LanguageRuntime = Parser.Language;
  })().catch((error) => {
    runtimeInitPromise = null;
    logger.error({ error, msg: "Failed to initialize tree-sitter runtime" });
    throw error;
  });

  return await runtimeInitPromise;
}

export async function loadLanguage(ext: string, spec: LanguageSpec) {
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
  const cloudPath = resolve(process.cwd(), spec.wasm);
  const localPath = resolve(process.cwd(), "node_modules/tree-sitter-wasms/out", spec.wasm);

  return fs.existsSync(cloudPath) ? cloudPath : localPath;
}

function lineOf(content: string, fragment: string) {
  const index = content.indexOf(fragment);
  if (index < 0) return;
  return content.slice(0, index).split(/\r?\n/u).length;
}

function extractNodeName(nodeText: string) {
  const firstLine = nodeText.split(/\r?\n/u, 1)[0]?.trim() ?? "";
  return /([A-Z_a-z]\w*)/.exec(firstLine)?.[1];
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
        confidence: routePattern.confidence ?? CONFIDENCE_LEVELS.astRoute,
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

      const declarationTypes = new Set(spec.declarations.flatMap((entry) => entry.types));
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

        if (declarationTypes.has(nodeType)) {
          exports += 1;
          const kind = declarationKindByType.get(nodeType) ?? "function";
          const name = extractNodeName(nodeText);
          if (name != null) {
            symbols.push({
              confidence: CONFIDENCE_LEVELS.astSymbol,
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
        confidence: CONFIDENCE_LEVELS.astStructure, // AST-based extraction has high confidence
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

export async function getRuntime() {
  await initRuntime();
  return ParserRuntime;
}

export function getSpecByExt(ext: string) {
  return SPECS[ext];
}
