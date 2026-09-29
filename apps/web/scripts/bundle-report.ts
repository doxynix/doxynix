/**
 * Offline bundle report for a build produced by `bun run analyze` (ANALYZE=true, webpack).
 *
 * `@next/bundle-analyzer` writes a treemap that is hard to read: every module is attributed
 * to a directory, nothing tells you what a given route actually downloads, and the biggest
 * entry (`@shikijs/langs`) is an artifact of code splitting rather than a real payload.
 *
 * This script reads the same `window.chartData` JSON, attributes every module to its npm
 * package, and reconstructs the webpack chunk graph from the build output so it can report
 * what each route pays up front versus what is code-split.
 *
 * Usage:
 *   bun run analyze:report                    # per-package table (client)
 *   bun run analyze:report routes             # per-route initial vs lazy payload
 *   bun run analyze:report groups             # per-package totals grouped by feature area
 *   bun run analyze:report chunks             # heavy chunks + which routes can reach them
 *   bun run analyze:report -- --file nodejs.html --top 30
 */
import { existsSync, readFileSync } from "node:fs";

import { sumBy } from "es-toolkit";
import fg from "fast-glob";
import { join, relative } from "pathe";

const APP_DIR = join(import.meta.dirname, "..");
const ANALYZE_DIR = join(APP_DIR, ".next", "analyze");
const CHUNKS_DIR = join(APP_DIR, ".next", "static", "chunks");
const BUILD_MANIFEST = join(APP_DIR, ".next", "build-manifest.json");

const REPORT_FILES = ["client.html", "edge.html", "nodejs.html"] as const;
type ReportFile = (typeof REPORT_FILES)[number];

// ---------------------------------------------------------------------------
// types
// ---------------------------------------------------------------------------

type ChartNode = {
  label?: string;
  path?: string;
  statSize?: number;
  parsedSize?: number;
  gzipSize?: number;
  concatenated?: boolean;
  groups?: ChartNode[];
};

type Leaf = {
  pkg: string;
  subpath: string;
  chunk: string;
  stat: number;
  parsed: number;
  gzip: number;
};

/** [stat, parsed, gzip] triple, used everywhere a size vector is accumulated. */
type Size = [number, number, number];

type PackageStats = {
  stat: number;
  parsed: number;
  gzip: number;
  files: Set<string>;
  chunks: Set<string>;
};

type ChunkGraph = {
  /** webpack chunk id -> chunk path relative to `.next` */
  idToFile: Map<string, string>;
  /** chunk path -> ids the chunk itself is registered under */
  fileIds: Map<string, Set<string>>;
  /** chunk path -> ids it blocks on before the entry runs (`.O(0, [ids], entry)`) */
  syncDeps: Map<string, Set<string>>;
  /** chunk path -> ids it imports asynchronously (`.e(id)`) */
  lazyDeps: Map<string, Set<string>>;
};

type RouteReport = {
  route: string;
  entry: string;
  initial: Set<string>;
  deferred: Set<string>;
};

// ---------------------------------------------------------------------------
// formatting helpers
// ---------------------------------------------------------------------------

const kb = (bytes: number): string =>
  bytes >= 1e6
    ? `${(bytes / 1e6).toFixed(1)} MB`.padStart(8)
    : `${(bytes / 1e3).toFixed(1)} KB`.padStart(8);

const addSize = (a: Size, b: Size): Size => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];

const totalOf = (sizes: Iterable<Size>): Size => {
  const out: Size = [0, 0, 0];
  for (const s of sizes) {
    out[0] += s[0];
    out[1] += s[1];
    out[2] += s[2];
  }
  return out;
};

const rule = (width: number, char = "-"): string => char.repeat(width);
const header = (title: string, width = 108): void => {
  console.info(rule(width, "="));
  console.info(`  ${title}`);
  console.info(rule(width, "="));
};

// ---------------------------------------------------------------------------
// module path -> npm package
// ---------------------------------------------------------------------------

/**
 * Bun's isolated store lays modules out as
 *   node_modules/.bun/@codemirror+lang-json@6.0.2/node_modules/@codemirror/lang-json/dist/index.js
 * where the store key is the package name with `/` turned into `+` and the version appended.
 */
const BUN_STORE_RE = /node_modules\/\.bun\/([^/]+?)(?:@([0-9][^/]*))?\/node_modules\/(.+)$/;

function resolvePackage(path: string): [string, string] {
  const idx = path.lastIndexOf("node_modules/");
  if (idx < 0) {
    const plain = path.replace(/^\.\//, "");
    return [plain.startsWith("..") ? "EXTERNAL" : "APP-CODE", plain];
  }

  const rest = path.slice(idx + "node_modules/".length);

  if (rest.startsWith(".bun/")) {
    const store = BUN_STORE_RE.exec(path);
    if (store) {
      const [, key, realPath] = store;
      const name = key.startsWith("@")
        ? `@${key.slice(1).split("+").join("/")}`
        : key.split("+")[0];
      return [name, realPath];
    }
  }

  const parts = rest.split("/");
  if (rest.startsWith("@")) {
    return [parts.slice(0, 2).join("/"), parts.slice(2).join("/")];
  }
  return [parts[0], parts.slice(1).join("/")];
}

// ---------------------------------------------------------------------------
// @next/bundle-analyzer payload
// ---------------------------------------------------------------------------

function loadChart(file: ReportFile): ChartNode[] {
  const path = join(ANALYZE_DIR, file);
  if (!existsSync(path)) {
    console.error(`bundle-report: ${relative(APP_DIR, path)} not found.`);
    console.error("Run `bun run analyze` first (ANALYZE=true next build --webpack).");
    process.exit(1);
  }

  const html = readFileSync(path, "utf8");
  const marker = "window.chartData = ";
  const start = html.indexOf(marker);
  if (start < 0) {
    console.error(`bundle-report: no chartData in ${file}.`);
    process.exit(1);
  }

  return JSON.parse(sliceJsonValue(html, start + marker.length)) as ChartNode[];
}

/**
 * Extract one JSON value starting at `from` (must be `[` or `{`).
 * The script tag holds several statements (`window.chartData = [...]`, then
 * `window.defaultSizes = ...`), so `JSON.parse` on the tail would choke.
 */
function sliceJsonValue(src: string, from: number): string {
  const start = src[from] === "[" || src[from] === "{" ? from : -1;
  if (start < 0) {
    throw new Error("bundle-report: chartData is not a JSON array");
  }

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < src.length; i += 1) {
    const char = src[i];

    if (escaped) {
      escaped = false;
      continue;
    }
    if (inString) {
      if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }
    if (char === '"') {
      inString = true;
      continue;
    }
    if (char === "[" || char === "{") {
      depth += 1;
    } else if (char === "]" || char === "}") {
      depth -= 1;
      if (depth === 0) {
        return src.slice(start, i + 1);
      }
    }
  }

  throw new Error("bundle-report: unterminated chartData JSON");
}

/** Flatten the treemap into one record per leaf module. */
function collectLeaves(chart: ChartNode[]): Leaf[] {
  const leaves: Leaf[] = [];

  const visit = (node: ChartNode, chunk: string): void => {
    const label = node.label ?? "";
    const path = (node.path ?? label).replace(" (concatenated)", "");

    if (node.concatenated) {
      for (const child of node.groups ?? []) {
        visit(child, chunk);
      }
      return;
    }

    if (!node.groups?.length) {
      const [pkg, subpath] = resolvePackage(path);
      leaves.push({
        chunk,
        gzip: node.gzipSize ?? 0,
        parsed: node.parsedSize ?? 0,
        pkg,
        stat: node.statSize ?? 0,
        subpath,
      });
      return;
    }

    for (const child of node.groups) {
      visit(child, chunk);
    }
  };

  for (const chunk of chart) {
    visit(chunk, chunk.label ?? "?");
  }

  return leaves;
}

function byPackage(leaves: Leaf[]): Map<string, PackageStats> {
  const out = new Map<string, PackageStats>();
  for (const leaf of leaves) {
    const stats = out.get(leaf.pkg) ?? {
      chunks: new Set<string>(),
      files: new Set<string>(),
      gzip: 0,
      parsed: 0,
      stat: 0,
    };
    stats.stat += leaf.stat;
    stats.parsed += leaf.parsed;
    stats.gzip += leaf.gzip;
    stats.files.add(leaf.subpath);
    stats.chunks.add(leaf.chunk);
    out.set(leaf.pkg, stats);
  }
  return out;
}

function byChunk(leaves: Leaf[]): Map<string, Map<string, Size>> {
  const out = new Map<string, Map<string, Size>>();
  for (const leaf of leaves) {
    let chunk = out.get(leaf.chunk);
    if (!chunk) {
      chunk = new Map<string, Size>();
      out.set(leaf.chunk, chunk);
    }
    const current = chunk.get(leaf.pkg) ?? [0, 0, 0];
    chunk.set(leaf.pkg, addSize(current, [leaf.stat, leaf.parsed, leaf.gzip]));
  }
  return out;
}

const chunkSize = (chunk: Map<string, Size>): Size => totalOf(chunk.values());

// ---------------------------------------------------------------------------
// webpack chunk graph
// ---------------------------------------------------------------------------

/**
 * Next's `__webpack_require__.u` resolves a chunk id to a filename as
 *
 *   e => 22943 === e ? "static/chunks/22943-<hash>.js"
 *            : ...
 *            : "static/chunks/" + ((map1)[e] || e) + "." + ((map2)[e]) + ".js"
 *
 * where `map1` optionally shortens the id (17377 -> "92c799b9") and `map2` holds the hash.
 * The two maps plus the special-cased branches cover the whole build; anything still missing
 * is resolved from the numeric prefix of the filename on disk.
 */
function parseRuntimeChunkIds(): Map<string, string> {
  const runtime = fg.sync("webpack-*.js", { absolute: true, cwd: CHUNKS_DIR }).sort().at(0);

  const idToFile = new Map<string, string>();
  if (!runtime) {
    return idToFile;
  }

  const src = readFileSync(runtime, "utf8");

  for (const [, id, num, hash] of src.matchAll(
    /(\d+)===e\?"static\/chunks\/(\d+)-([0-9a-f]+)\.js"/g,
  )) {
    idToFile.set(id, `static/chunks/${num}-${hash}.js`);
  }

  const head = '"static/chunks/"+((';
  const mid = '})[e]||e)+"."+({';
  const tail = '})[e]+".js"';
  const headIdx = src.indexOf(head);
  const midIdx = src.indexOf(mid, headIdx);
  const tailIdx = src.indexOf(tail, midIdx);
  if (headIdx < 0 || midIdx < 0 || tailIdx < 0) {
    return idToFile;
  }

  const readMap = (from: number, to: number): Map<string, string> =>
    new Map(
      Array.from(src.slice(from, to).matchAll(/(\d+):"([^"]+)"/g), ([, id, hash]) => [id, hash]),
    );

  const names = readMap(headIdx + head.length, midIdx);
  const hashes = readMap(midIdx + mid.length, tailIdx);

  for (const [id, hash] of hashes) {
    idToFile.set(id, `static/chunks/${names.get(id) ?? id}.${hash}.js`);
  }

  return idToFile;
}

function listChunks(): string[] {
  return fg
    .sync("**/*.js", { cwd: CHUNKS_DIR })
    .map((file) => `static/chunks/${file.split("\\").join("/")}`);
}

function buildGraph(): ChunkGraph {
  const idToFile = parseRuntimeChunkIds();
  const files = listChunks();

  for (const file of files) {
    const base = file.split("/").at(-1) ?? "";
    const match = /^(\d+)[-.]/.exec(base);
    if (match && !idToFile.has(match[1])) {
      idToFile.set(match[1], file);
    }
  }

  const fileIds = new Map<string, Set<string>>();
  const syncDeps = new Map<string, Set<string>>();
  const lazyDeps = new Map<string, Set<string>>();

  for (const file of files) {
    const src = readFileSync(join(APP_DIR, ".next", file), "utf8");

    const own = new Set<string>();
    for (const [, ids] of src.matchAll(/\.push\(\[\[([\d,]+)\]/g)) {
      for (const id of ids.split(",")) {
        if (id) {
          own.add(id);
        }
      }
    }

    const sync = new Set<string>();
    for (const [, ids] of src.matchAll(/\.O\(\s*[\w$]+\s*,\s*\[([\d,\s]+)\]/g)) {
      for (const id of ids.replaceAll(/\s/g, "").split(",")) {
        if (id) {
          sync.add(id);
        }
      }
    }

    const lazy = new Set<string>();
    for (const [, id] of src.matchAll(/\.e\((\d+)\)/g)) {
      lazy.add(id);
    }

    for (const id of own) {
      sync.delete(id);
      lazy.delete(id);
    }

    fileIds.set(file, own);
    syncDeps.set(file, sync);
    lazyDeps.set(file, lazy);
  }

  return { fileIds, idToFile, lazyDeps, syncDeps };
}

// ---------------------------------------------------------------------------
// routes
// ---------------------------------------------------------------------------

/** Route-scoped chunks live at `static/chunks/app/<route>-<hash>.js`. */
function routeOf(chunk: string): string | null {
  const marker = "static/chunks/app/";
  const idx = chunk.indexOf(marker);
  if (idx < 0) {
    return null;
  }
  const tail = chunk.slice(idx + marker.length);
  return tail.replace(/-[0-9a-f]{6,}\.js$/, "");
}

function rootMainFiles(): Set<string> {
  if (!existsSync(BUILD_MANIFEST)) {
    return new Set();
  }
  const manifest = JSON.parse(readFileSync(BUILD_MANIFEST, "utf8")) as { rootMainFiles?: string[] };
  return new Set(manifest.rootMainFiles ?? []);
}

function closure(
  edges: Map<string, Set<string>>,
  graph: ChunkGraph,
  sizes: Map<string, Map<string, Size>>,
  seeds: Iterable<string>,
): Set<string> {
  const seen = new Set<string>();
  const stack: string[] = [];

  for (const seed of seeds) {
    if (sizes.has(seed)) {
      seen.add(seed);
    }
    stack.push(seed);
  }

  while (stack.length > 0) {
    const current = stack.pop() as string;
    for (const id of edges.get(current) ?? []) {
      const target = graph.idToFile.get(id);
      if (target && sizes.has(target) && !seen.has(target)) {
        seen.add(target);
        stack.push(target);
      }
    }
  }

  return seen;
}

function buildRouteReports(
  graph: ChunkGraph,
  sizes: Map<string, Map<string, Size>>,
): RouteReport[] {
  const always = rootMainFiles();
  const reports: RouteReport[] = [];

  for (const chunk of sizes.keys()) {
    const route = routeOf(chunk);
    if (!route) {
      continue;
    }

    const initial = closure(graph.syncDeps, graph, sizes, [chunk]);
    for (const file of always) {
      if (sizes.has(file)) {
        initial.add(file);
      }
    }

    const deferred = closure(graph.lazyDeps, graph, sizes, [chunk, ...initial]);
    for (const file of initial) {
      deferred.delete(file);
    }

    reports.push({ deferred, entry: chunk, initial, route });
  }

  return reports;
}

// ---------------------------------------------------------------------------
// reports
// ---------------------------------------------------------------------------

function reportPackages(file: ReportFile, top: number): void {
  const chart = loadChart(file);
  const leaves = collectLeaves(chart);
  const packages = [...byPackage(leaves).entries()].sort((a, b) => b[1].parsed - a[1].parsed);
  const chunkCount = new Set(leaves.map((leaf) => leaf.chunk)).size;
  const totals = totalOf(
    packages.map(([, stats]) => [stats.stat, stats.parsed, stats.gzip] as Size),
  );

  header(`${file} — ${chunkCount} chunks, ${leaves.length} modules, ${packages.length} packages`);
  console.info(`  TOTAL  stat ${kb(totals[0])}   parsed ${kb(totals[1])}   gzip ${kb(totals[2])}`);
  console.info(rule(108));
  console.info(
    `${"package".padEnd(44)}${"parsed".padStart(11)}${"gzip".padStart(11)}${"files".padStart(7)}${"chunks".padStart(8)}${"share".padStart(8)}`,
  );
  console.info(rule(108));

  for (const [pkg, stats] of packages.slice(0, top)) {
    const share = ((100 * stats.parsed) / totals[1]).toFixed(1);
    console.info(
      `${pkg.padEnd(44)}${kb(stats.parsed)}${kb(stats.gzip)}${String(stats.files.size).padStart(7)}${String(stats.chunks.size).padStart(8)}${`${share}%`.padStart(8)}`,
    );
  }

  console.info(rule(108));
  for (const [label, slice] of [
    ["sum of shown", packages.slice(0, top)],
    [`rest (${packages.length - top} pkgs)`, packages.slice(top)],
  ] as const) {
    const [, parsed, gzip] = totalOf(slice.map(([, s]) => [s.stat, s.parsed, s.gzip] as Size));
    console.info(`${label.padEnd(44)}${kb(parsed)}${kb(gzip)}`);
  }
}

function reportRoutes(file: ReportFile, filter?: string): void {
  const graph = buildGraph();
  const sizes = byChunk(collectLeaves(loadChart(file)));

  const always = [...rootMainFiles()].filter((f) => sizes.has(f));
  const base = totalOf(always.map((f) => chunkSize(sizes.get(f) as Map<string, Size>)));
  const basePkgs = new Map<string, number>();
  for (const f of always) {
    for (const [pkg, size] of sizes.get(f) ?? []) {
      basePkgs.set(pkg, (basePkgs.get(pkg) ?? 0) + size[1]);
    }
  }

  header(`${file} — every page pays this (build-manifest rootMainFiles)`);
  console.info(`  ${kb(base[1])} parsed / ${kb(base[2])} gzip`);
  for (const [pkg, parsed] of [...basePkgs].sort((a, b) => b[1] - a[1]).slice(0, 8)) {
    console.info(`${kb(parsed).padStart(19)}  ${pkg}`);
  }

  const reports = buildRouteReports(graph, sizes)
    .filter((r) => !r.route.startsWith("api/"))
    .filter((r) => !filter || r.route.includes(filter));

  console.info("");
  header("PER-ROUTE  (initial blocks first render, lazy is code-split on demand)");

  const rows = reports
    .map((r) => {
      const i = totalOf([...r.initial].map((f) => chunkSize(sizes.get(f) as Map<string, Size>)));
      const d = totalOf([...r.deferred].map((f) => chunkSize(sizes.get(f) as Map<string, Size>)));
      return { ...r, deferredSize: d, initialSize: i };
    })
    .sort((a, b) => b.initialSize[1] - a.initialSize[1]);

  for (const row of rows) {
    console.info("");
    console.info(
      `  ${kb(row.initialSize[1])} / ${kb(row.initialSize[2])} initial  +  ${kb(row.deferredSize[1])} / ${kb(row.deferredSize[2])} lazy    ${row.route}`,
    );

    const initialPkgs = new Map<string, number>();
    for (const f of row.initial) {
      for (const [pkg, size] of sizes.get(f) ?? []) {
        initialPkgs.set(pkg, (initialPkgs.get(pkg) ?? 0) + size[1]);
      }
    }
    for (const [pkg, parsed] of [...initialPkgs].sort((a, b) => b[1] - a[1]).slice(0, 7)) {
      console.info(`${kb(parsed).padStart(19)}  ${pkg}`);
    }

    const lazyPkgs = new Map<string, number>();
    for (const f of row.deferred) {
      for (const [pkg, size] of sizes.get(f) ?? []) {
        lazyPkgs.set(pkg, (lazyPkgs.get(pkg) ?? 0) + size[1]);
      }
    }
    const topLazy = [...lazyPkgs].sort((a, b) => b[1] - a[1]).slice(0, 5);
    if (topLazy.length > 0) {
      console.info(
        `${"~lazy~".padStart(19)}  ${topLazy.map(([p, v]) => `${p} ${kb(v)}`).join(", ")}`,
      );
    }
  }
}

/** Feature areas, so a 480-package table is readable at a glance. */
const FEATURE_GROUPS: [string, RegExp][] = [
  [
    "Syntax highlight (shiki)",
    /^@shikijs\/|^shiki$|^oniguruma-to-es$|^hast|^mdast|^micromark|^unist|^remark|^rehype|^property-information|^space-separated|^comma-separated|^html-|^web-namespaces|^string-byte-length|^character-entities|^decode-named|^trim-|^devlop$|^ccount$|^zwitch$|^bail$|^trough$|^longest-streak|^vfile/,
  ],
  [
    "Docs renderer (mermaid+elk+marked+katex)",
    /^mermaid$|^@mermaid-js\/|^elkjs$|^marked$|^dompurify$|^roughjs$|^khroma$|^katex$|^cose-base$|^cytoscape|^dagre-d3-es$|^d3/,
  ],
  ["API reference UI (scalar)", /^@scalar\//],
  [
    "Code editor (codemirror+lezer)",
    /^@codemirror\/|^@lezer\/|^@uiw\/|^style-to-|^jsonc-parser$|^w3c-keyname$|^crelt$/,
  ],
  ["Graph canvas (xyflow)", /^@xyflow\//],
  ["Observability (sentry)", /^@sentry\//],
  ["Analytics (posthog)", /^posthog-js$/],
  ["Realtime (ably)", /^ably$/],
  ["Charts (recharts)", /^recharts$|^victory-|^@reduxjs\/|^immer$|^reselect$|^decimal\.js-light$/],
  ["i18n", /^next-intl$|^@formatjs\/|^intl-/],
  ["Validation (zod/jose/temporal)", /^zod$|^jose$|^temporal-polyfill$|^uuid$|^nanoid$/],
  [
    "UI kit (radix/headlessui/sonner)",
    /^@radix-ui\/|^radix-vue$|^@headlessui\/|^@vue\/|^sonner$|^vue-sonner$|^@vueuse\/|^focus-trap$|^use-sidecar$|^react-remove-scroll|^aria-hidden$/,
  ],
  ["Motion / animation", /^motion$|^motion-dom$|^framer-motion$/],
  [
    "Data fetching / forms",
    /^@tanstack\/|^swr$|^react-hook-form$|^react-day-picker$|^@internationalized\/|^date-fns$|^@react-dnd\//,
  ],
  ["Icons", /^lucide-react$/],
  ["Next runtime", /^next$|^react$|^react-dom$|^scheduler$|^styled-jsx$/],
  ["Trigger.dev / AI SDK", /^@trigger\.dev\/|^ai$|^@ai-sdk\//],
  ["App code", /^APP-CODE$/],
];

function reportGroups(file: ReportFile): void {
  const packages = [...byPackage(collectLeaves(loadChart(file))).entries()].sort(
    (a, b) => b[1].parsed - a[1].parsed,
  );
  const total = sumBy(packages, ([, stats]) => stats.parsed);

  const claimed = new Set<string>();
  const groups: { name: string; parsed: number; gzip: number; count: number }[] = [];

  for (const [name, re] of FEATURE_GROUPS) {
    const matched = packages.filter(([pkg]) => !claimed.has(pkg) && re.test(pkg));
    if (matched.length === 0) {
      continue;
    }
    for (const [pkg] of matched) {
      claimed.add(pkg);
    }
    groups.push({
      count: matched.length,
      gzip: sumBy(matched, ([, s]) => s.gzip),
      name,
      parsed: sumBy(matched, ([, s]) => s.parsed),
    });
  }

  header(`${file} — bundle grouped by feature area`);
  console.info(
    `${"feature area".padEnd(44)}${"parsed".padStart(11)}${"gzip".padStart(11)}${"pkgs".padStart(7)}${"share".padStart(8)}`,
  );
  console.info(rule(82));

  for (const g of [...groups].sort((a, b) => b.parsed - a.parsed)) {
    console.info(
      `${g.name.padEnd(44)}${kb(g.parsed)}${kb(g.gzip)}${String(g.count).padStart(7)}${`${((100 * g.parsed) / total).toFixed(1)}%`.padStart(8)}`,
    );
  }

  const rest = packages.filter(([pkg]) => !claimed.has(pkg));
  console.info(rule(82));
  for (const [pkg, stats] of rest.slice(0, 20)) {
    console.info(
      `${`  ${pkg}`.padEnd(44)}${kb(stats.parsed)}${kb(stats.gzip)}${"1".padStart(7)}${`${((100 * stats.parsed) / total).toFixed(1)}%`.padStart(8)}`,
    );
  }
  console.info("");
  console.info(`ungrouped: ${kb(sumBy(rest, ([, s]) => s.parsed))} across ${rest.length} packages`);
}

function reportChunks(file: ReportFile, minKb: number, filter?: string): void {
  const graph = buildGraph();
  const sizes = byChunk(collectLeaves(loadChart(file)));
  const always = rootMainFiles();
  const entries = [...sizes.keys()].filter((c) => routeOf(c) !== null);

  const reachCache = new Map<string, Set<string>>();
  const reach = (start: string): Set<string> => {
    const cached = reachCache.get(start);
    if (cached) {
      return cached;
    }
    const seen = closure(graph.lazyDeps, graph, sizes, [start]);
    for (const id of graph.syncDeps.get(start) ?? []) {
      const target = graph.idToFile.get(id);
      if (target && sizes.has(target)) {
        for (const f of closure(graph.lazyDeps, graph, sizes, [target])) {
          seen.add(f);
        }
      }
    }
    reachCache.set(start, seen);
    return seen;
  };

  header(`${file} — chunks over ${minKb} KB and the routes that can reach them`);

  const heavy = [...sizes.entries()]
    .map(([chunk, pkgs]) => ({ chunk, pkgs, size: chunkSize(pkgs) }))
    .filter((row) => row.size[1] >= minKb * 1e3)
    .sort((a, b) => b.size[1] - a.size[1]);

  for (const row of heavy) {
    const owners = entries
      .filter((e) => e === row.chunk || reach(e).has(row.chunk))
      .map((e) => routeOf(e) as string)
      .filter((route) => !filter || route.includes(filter));

    console.info("");
    console.info(
      `  ${kb(row.size[1])} ${kb(row.size[2])}  ${row.chunk}   [${always.has(row.chunk) ? "ALWAYS" : "async"}]`,
    );
    const top = [...row.pkgs].sort((a, b) => b[1][1] - a[1][1]).slice(0, 5);
    console.info(`      ${top.map(([p, s]) => `${p} ${kb(s[1])}`).join(", ")}`);
    console.info(
      `      routes: ${owners.length === 0 ? "none reachable" : [...new Set(owners)].slice(0, 8).join(", ")}`,
    );
  }
}

// ---------------------------------------------------------------------------
// cli
// ---------------------------------------------------------------------------

const VALUE_FLAGS = new Set(["file", "top", "min-kb", "route"]);

const USAGE = `bundle-report — per-package / per-route bundle analysis

  bun run analyze:report [command] [options]

commands
  pkgs      per-package table                        (default)
  routes    per-route initial vs lazy payload
  groups    totals grouped by feature area
  chunks    heavy chunks and the routes that reach them

options
  --file <name>    ${REPORT_FILES.join(" | ")}   (default: client.html)
  --top <n>        rows in the table                  (default: 45)
  --min-kb <n>     threshold for the chunks report    (default: 100)
  --route <text>   only routes whose path contains <text>
  --help           show this message`;

function main(argv: string[]): void {
  if (argv.includes("--help") || argv.includes("-h")) {
    console.info(USAGE);
    return;
  }

  // The first bare word is the command; `--flag value` pairs are consumed together.
  let command = "pkgs";
  const values = new Map<string, string>();
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === undefined) {
      continue;
    }
    if (arg.startsWith("--")) {
      const name = arg.slice(2);
      if (VALUE_FLAGS.has(name)) {
        values.set(name, argv[i + 1] ?? "");
        i += 1;
      }
      continue;
    }
    if (command === "pkgs") {
      command = arg;
    }
  }

  const file = (values.get("file") ?? "client.html") as ReportFile;
  const top = Number(values.get("top") ?? 45);
  const minKb = Number(values.get("min-kb") ?? 100);
  const route = values.get("route");

  if (!REPORT_FILES.includes(file)) {
    console.error(
      `bundle-report: unknown file "${file}", expected one of ${REPORT_FILES.join(", ")}`,
    );
    process.exit(1);
  }

  switch (command) {
    case "routes": {
      reportRoutes(file, route);
      break;
    }
    case "groups": {
      reportGroups(file);
      break;
    }
    case "chunks": {
      reportChunks(file, minKb, route);
      break;
    }
    default: {
      reportPackages(file, top);
    }
  }
}

main(process.argv.slice(2));
