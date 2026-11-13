import fs from "node:fs";
import { createRequire } from "node:module";

import { join, resolve } from "pathe";
import { Language, Parser, type Tree } from "web-tree-sitter";

import { appLogger } from "@/server/core/app-logger";

/**
 * Tree-sitter runtime: language specs, wasm grammar loading, and the parser
 * handle. Lives in core because the code optimizer needs to parse files without
 * knowing anything about analysis; the analysis extractors build on top of it.
 */
const nodeRequire = createRequire(import.meta.url);

export type SymbolKind =
  | "class"
  | "const"
  | "enum"
  | "function"
  | "interface"
  | "method"
  | "module"
  | "struct"
  | "trait"
  | "type"
  | "variable";

type LanguageSpecBody = {
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
  wasmDir: string;
};

const TS_DECLARATIONS = [
  {
    kind: "function" as SymbolKind,
    types: ["function_declaration", "method_definition", "arrow_function"],
  },
  { kind: "class" as SymbolKind, types: ["class_declaration", "abstract_class_declaration"] },
  { kind: "interface" as SymbolKind, types: ["interface_declaration"] },
  { kind: "type" as SymbolKind, types: ["type_alias_declaration"] },
  { kind: "enum" as SymbolKind, types: ["enum_declaration"] },
];

const TS_ROUTE_PATTERNS = [
  {
    framework: "js-ts-router",
    methodIndex: 1,
    pathIndex: 2,
    pattern: /\.(get|post|put|patch|delete)\(\s*["']([^"']+)["']/g,
  },
];

const SPECS: Record<string, LanguageSpec> = {
  ".c": {
    declarations: [
      { kind: "function", types: ["function_definition"] },
      { kind: "struct", types: ["struct_specifier", "type_definition"] },
    ],
    entrypoints: [/\bint\s+main\s*\(/],
    imports: { patterns: [/^\s*#include\s+"([^"]+)"/m], types: ["preproc_include"] },
    wasm: "tree-sitter-c.wasm",
    wasmDir: "c",
  },
  ".cjs": {
    declarations: [
      { kind: "function", types: ["function_declaration"] },
      { kind: "class", types: ["class_declaration"] },
    ],
    entrypoints: [/\bapp\.listen\(/],
    imports: { patterns: [/require\s*\(\s*["']([^"']+)["']\s*\)/], types: ["call_expression"] },
    wasm: "tree-sitter-javascript.wasm",
    wasmDir: "javascript",
  },
  ".cpp": {
    declarations: [
      { kind: "function", types: ["function_definition", "template_declaration"] },
      { kind: "class", types: ["class_specifier", "namespace_definition"] },
    ],
    entrypoints: [/\bint\s+main\s*\(/],
    imports: { patterns: [/^\s*#include\s+"([^"]+)"/m], types: ["preproc_include"] },
    wasm: "tree-sitter-cpp.wasm",
    wasmDir: "cpp",
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
    wasm: "tree-sitter-c_sharp.wasm",
    wasmDir: "c_sharp",
  },
  ".cts": {
    declarations: TS_DECLARATIONS,
    entrypoints: [/\bbootstrap\(\)/],
    imports: { patterns: [/from\s+["']([^"']+)["']/], types: ["import_statement"] },
    wasm: "tree-sitter-typescript.wasm",
    wasmDir: "typescript",
  },
  ".erl": {
    declarations: [{ kind: "function", types: ["function_clause"] }],
    entrypoints: [/-export\s*\(\s*\[\s*main/],
    imports: { patterns: [/-include\s*\(\s*["']([^"']+)["']\s*\)/], types: ["pp_directive"] },
    wasm: "tree-sitter-erlang.wasm",
    wasmDir: "erlang",
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
        pattern: /\.(GET|POST|PUT|PATCH|DELETE)\s*\(\s*"([^"]+)"/g,
      },
      {
        framework: "Echo",
        methodIndex: 1,
        pathIndex: 2,
        pattern: /\.Add\(\s*"([A-Z]+)"\s*,\s*"([^"]+)"/g,
      },
    ],
    wasm: "tree-sitter-go.wasm",
    wasmDir: "go",
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
    wasmDir: "java",
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
    wasmDir: "julia",
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
    wasmDir: "javascript",
  },
  ".jsx": {
    declarations: [
      { kind: "function", types: ["function_declaration"] },
      { kind: "class", types: ["class_declaration"] },
    ],
    entrypoints: [/\bcreateRoot\b/, /\bReactDOM\.render\b/],
    imports: { patterns: [/from\s+["']([^"']+)["']/], types: ["import_statement"] },
    wasm: "tree-sitter-javascript.wasm",
    wasmDir: "javascript",
  },
  ".kt": {
    declarations: [
      {
        kind: "class",
        types: ["class_declaration", "object_declaration"],
      },
      { kind: "function", types: ["function_declaration"] },
    ],
    entrypoints: [/\bval\s+app\b/, /\bfun\s+main\b/],
    imports: { patterns: [/^import\s+([\w.]+)/m], types: ["import_header"] },
    wasm: "tree-sitter-kotlin.wasm",
    wasmDir: "kotlin",
  },
  ".lua": {
    declarations: [{ kind: "function", types: ["function_declaration", "function_definition"] }],
    entrypoints: [/\bmain\s*\(/],
    imports: { patterns: [/\brequire\s*\(?\s*["']([^"']+)["']\s*\)?/], types: ["function_call"] },
    wasm: "tree-sitter-lua.wasm",
    wasmDir: "lua",
  },
  ".m": {
    declarations: [
      { kind: "method", types: ["method_definition"] },
      { kind: "class", types: ["class_interface", "category_interface"] },
    ],
    entrypoints: [/main\s*\(|NSApplicationMain/],
    imports: { patterns: [/#import\s+["<]([^">]+)[">]/m], types: ["preproc_import"] },
    wasm: "tree-sitter-objc.wasm",
    wasmDir: "objc",
  },
  ".mjs": {
    declarations: [
      { kind: "function", types: ["function_declaration"] },
      { kind: "class", types: ["class_declaration"] },
    ],
    entrypoints: [/\bapp\.listen\(/],
    imports: { patterns: [/from\s+["']([^"']+)["']/], types: ["import_statement"] },
    wasm: "tree-sitter-javascript.wasm",
    wasmDir: "javascript",
  },
  ".mts": {
    declarations: TS_DECLARATIONS,
    entrypoints: [/\bbootstrap\(\)/],
    imports: { patterns: [/from\s+["']([^"']+)["']/], types: ["import_statement"] },
    wasm: "tree-sitter-typescript.wasm",
    wasmDir: "typescript",
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
    wasmDir: "php",
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
    wasmDir: "python",
  },
  ".rb": {
    declarations: [
      { kind: "class", types: ["class", "module"] },
      { kind: "function", types: ["method"] },
    ],
    entrypoints: [/config\.ru/, /bin\/rails/],
    imports: { patterns: [/require\s+["']([^"']+)["']/m], types: ["require"] },
    wasm: "tree-sitter-ruby.wasm",
    wasmDir: "ruby",
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
    wasmDir: "rust",
  },
  ".sh": {
    declarations: [{ kind: "function", types: ["function_definition"] }],
    entrypoints: [/^#!\//],
    imports: { patterns: [/\bsource\s+([\w./-]+)/m, /^\.\s+([\w./-]+)/m], types: ["command"] },
    wasm: "tree-sitter-bash.wasm",
    wasmDir: "bash",
  },
  ".swift": {
    declarations: [
      { kind: "class", types: ["class_declaration"] },
      { kind: "function", types: ["function_declaration"] },
    ],
    entrypoints: [/@main/],
    imports: { patterns: [/^import\s+(\w+)/m], types: ["import_declaration"] },
    wasm: "tree-sitter-swift.wasm",
    wasmDir: "swift",
  },
  ".ts": {
    declarations: TS_DECLARATIONS,
    entrypoints: [/\bbootstrap\(\)/, /\bcreateServer\b/, /\bnew Hono\b/],
    imports: { patterns: [/from\s+["']([^"']+)["']/], types: ["import_statement"] },
    routePatterns: TS_ROUTE_PATTERNS,
    wasm: "tree-sitter-typescript.wasm",
    wasmDir: "typescript",
  },
  ".tsx": {
    declarations: TS_DECLARATIONS,
    entrypoints: [/\bcreateRoot\b/, /\bbootstrap\(\)/],
    imports: { patterns: [/from\s+["']([^"']+)["']/], types: ["import_statement"] },
    routePatterns: TS_ROUTE_PATTERNS,
    wasm: "tree-sitter-tsx.wasm",
    wasmDir: "tsx",
  },
};

export const TREE_SITTER_SUPPORTED_EXTENSIONS = Object.keys(SPECS);

let runtimeInitPromise: null | Promise<void> = null;
let runtimeInitialized = false;
const languageCache = new Map<string, Promise<Language>>();

async function initRuntime(): Promise<void> {
  // The wasm runtime outlives `disposeTreeSitter`; only parsers, languages and the
  // in-flight promise are dropped there, so `Parser.init` runs at most once per process.
  if (runtimeInitialized) {
    return;
  }

  runtimeInitPromise ??= (async () => {
    const runtimeWasmName = "web-tree-sitter.wasm";
    const pathsToTry = [
      resolve(process.cwd(), runtimeWasmName),
      resolve(process.cwd(), "node_modules/web-tree-sitter", runtimeWasmName),
      join(resolve(nodeRequire.resolve("web-tree-sitter"), ".."), runtimeWasmName),
    ];

    // turbopackIgnore stops NFT from tracing the whole project for this path
    const finalWasmPath = pathsToTry.find((p) => fs.existsSync(/* turbopackIgnore: true */ p));
    if (!finalWasmPath) {
      throw new Error(`[TreeSitter] Runtime WASM not found. Checked: ${pathsToTry.join(", ")}`);
    }

    await Parser.init({
      locateFile: (name: string) => {
        if (name === runtimeWasmName) {
          return finalWasmPath;
        }
        return name;
      },
    });

    appLogger.info({ msg: "Tree-sitter runtime ready", wasm: finalWasmPath });
    runtimeInitialized = true;
  })();

  return runtimeInitPromise;
}

export async function loadLanguage(ext: string, spec: LanguageSpec) {
  await initRuntime();

  const cached = languageCache.get(ext);
  if (cached != null) {
    return cached;
  }

  const loading = (async () => {
    const wasmPath = resolveGrammarWasmPath(spec);

    // turbopackIgnore stops NFT from tracing the whole project for this path
    const wasmBytes = fs.readFileSync(/* turbopackIgnore: true */ wasmPath);

    return Language.load(wasmBytes);
  })().catch((error) => {
    languageCache.delete(ext);
    appLogger.error({ error, ext, msg: "Failed to load language grammar" });
    throw error;
  });

  languageCache.set(ext, loading);
  return loading;
}

export function resolveGrammarWasmPath(spec: LanguageSpec): string {
  const dirname = import.meta.dirname as string | undefined;
  const candidates = [
    resolve(process.cwd(), "vendor/wasms", spec.wasm),
    resolve(process.cwd(), "node_modules/tree-sitter-wasm/out", spec.wasmDir, spec.wasm),
    ...(dirname == null ? [] : [resolve(dirname, "../../../../vendor/wasms", spec.wasm)]),
  ];

  for (const path of candidates) {
    // turbopackIgnore stops NFT from walking node_modules recursively
    if (fs.existsSync(/* turbopackIgnore: true */ path)) {
      return path;
    }
  }

  const errorContext = {
    checkedPaths: candidates,
    cwd: process.cwd(),
    env: process.env.NODE_ENV,
    specWasm: spec.wasm,
  };

  appLogger.error({ errorContext, msg: "Tree-sitter grammar not found" });

  throw new Error(
    `[TreeSitter] Grammar WASM not found: ${spec.wasm}. Ensure it is included in trigger.config.ts additionalFiles.`,
  );
}

export type LanguageSpec = LanguageSpecBody;

export async function getRuntime() {
  await initRuntime();
  return Parser;
}

export function getSpecByExt(ext: string) {
  return SPECS[ext];
}

export async function createParser(): Promise<Parser> {
  await initRuntime();
  return new Parser();
}

// Replaces the parse timeout 0.27 removed: a pathological file must not tie up the parser
// indefinitely, so oversized sources are skipped instead of handed to the wasm parser.
export const MAX_PARSE_BYTES = 5_000_000;

export function parseSource(
  parser: Parser,
  source: string,
  maxBytes = MAX_PARSE_BYTES,
): null | Tree {
  if (Buffer.byteLength(source, "utf8") > maxBytes) {
    return null;
  }

  return parser.parse(source);
}

const parserCache = new Map<string, Promise<Parser>>();

export async function getParserForExt(ext: string): Promise<Parser> {
  const cached = parserCache.get(ext);
  if (cached != null) {
    return cached;
  }

  const created = createParser();

  parserCache.set(ext, created);
  // Mirrors `loadLanguage`: a transient failure must not poison the cache for this extension.
  created.catch(() => {
    if (parserCache.get(ext) === created) {
      parserCache.delete(ext);
    }
  });
  return created;
}

export async function disposeTreeSitter(): Promise<void> {
  // Settle an in-flight bootstrap before clearing it; a second `Parser.init()` is unsafe.
  await runtimeInitPromise?.catch(() => null);
  runtimeInitPromise = null;

  for (const parserPromise of parserCache.values()) {
    const parser = await parserPromise.catch(() => null);
    parser?.delete();
  }
  parserCache.clear();
  languageCache.clear();
}
