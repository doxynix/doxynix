import { execSync } from "node:child_process";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

import fg from "fast-glob";
import { dirname, resolve } from "pathe";

type Manifest = {
  author?: string | { name?: string; url?: string };
  contributors?: Array<{ author?: boolean; name?: string; url?: string }>;
  homepage?: string;
  name?: string;
  private?: boolean;
  repository?: string | { directory?: string; type?: string; url?: string };
};

type BunLicenseEntry = {
  author?: string;
  description?: string;
  homepage?: string;
  license?: string;
  name: string;
  paths?: string[];
  versions?: string[];
};

type RepoInfo = { host: string; owner: string; url: string };

type AuthorGroup = {
  author: string;
  authorLink: string;
  avatar: null | string;
  packages: Array<{ license: string; name: string }>;
};

const DISPLAY_NAMES: Record<string, string> = {
  axiomhq: "Axiom",
  biomejs: "Biome",
  codemirror: "CodeMirror",
  definitelytyped: "DefinitelyTyped",
  "drizzle-team": "Drizzle Team",
  emilkowalski: "Emil Kowalski",
  eslint: "ESLint",
  evilmartians: "Evil Martians",
  facebook: "Meta",
  "faker-js": "Faker.js",
  "feature-sliced": "Feature-Sliced",
  "fuma-nama": "Fumadocs",
  getsentry: "Sentry",
  googlechrome: "Google Chrome",
  honojs: "Hono",
  jsdom: "jsdom",
  "lucide-icons": "Lucide",
  "mermaid-js": "Mermaid JS",
  microsoft: "Microsoft",
  motiondivision: "Motion",
  nodejs: "Node.js",
  octokit: "GitHub",
  "oxc-project": "OXC",
  pmndrs: "Poimandres",
  posthog: "PostHog",
  prettier: "Prettier",
  prisma: "Prisma",
  "radix-ui": "Radix UI",
  "react-hook-form": "React Hook Form",
  recharts: "Recharts",
  rehypejs: "Rehype",
  remarkjs: "Remark",
  resend: "Resend",
  secretlint: "Secretlint",
  shikijs: "Shiki",
  "stryker-mutator": "Stryker Mutator",
  svix: "Svix",
  "syntax-tree": "Syntax Tree",
  "t3-oss": "T3 OSS",
  tailwindlabs: "Tailwind Labs",
  tanstack: "TanStack",
  "testing-library": "Testing Library",
  triggerdotdev: "Trigger.dev",
  trpc: "tRPC",
  "typescript-eslint": "TypeScript ESLint",
  typestrong: "TypeStrong",
  uiwjs: "UIW",
  unifiedjs: "Unified.js",
  unjs: "UnJS",
  upstash: "Upstash",
  vercel: "Vercel",
  "vercel-labs": "Vercel Labs",
  "vitest-dev": "Vitest",
  xyflow: "Xyflow",
  zenstackhq: "ZenStack",
};

const scriptDir = dirname(fileURLToPath(import.meta.url));
const appDir = resolve(scriptDir, "..");
const repoRoot = resolve(appDir, "../..");
const outputPath = resolve(appDir, "src/features/high-five/model/licenses.json");

const prettify = (value: string) =>
  value
    .replace(/^@/, "")
    .split(/[-_.]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const toPublicUrl = (value: string | undefined) => {
  if (!value) {
    return null;
  }

  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.toString().replace(/\/$/, "")
      : null;
  } catch {
    return null;
  }
};

const cleanAuthor = (value: string | undefined) => {
  if (!value) {
    return "";
  }

  return (
    value
      .replaceAll(/<[^>]*>/g, "")
      .replaceAll(/\([^)]*\)/g, "")
      .split(/\s+/)
      .filter((token) => !token.includes("@"))
      .join(" ")
      .trim() || ""
  );
};

const parseRepository = (value: string | undefined): RepoInfo | null => {
  if (!value) {
    return null;
  }

  const raw = value.trim().replace(/^git\+/, "");
  let host = "";
  let rest = "";

  const scp = /^git@([^:]+):(.+)$/.exec(raw);
  const shortcut = /^(github|gitlab|bitbucket):(.+)$/.exec(raw);
  const url = /^(?:https?|ssh|git):\/\/(?:[^@/]+@)?([^/]+)\/(.+)$/.exec(raw);
  const bare = /^([\w.-]+)\/([\w.-]+)$/.exec(raw);

  if (scp) {
    host = scp[1];
    rest = scp[2];
  } else if (shortcut) {
    host = shortcut[1] === "bitbucket" ? "bitbucket.org" : `${shortcut[1]}.com`;
    rest = shortcut[2];
  } else if (url) {
    host = url[1];
    rest = url[2];
  } else if (bare) {
    host = "github.com";
    rest = raw;
  } else {
    return null;
  }

  const segments = rest
    .replace(/\.git$/, "")
    .replace(/[#?].*$/, "")
    .split("/")
    .filter(Boolean);

  if (segments.length < 2) {
    return null;
  }

  return {
    host: host.toLowerCase(),
    owner: segments[0],
    url: `https://${host.toLowerCase()}/${segments[0]}/${segments[1]}`,
  };
};

const resolveRepository = (manifest: Manifest): RepoInfo | null =>
  parseRepository(
    typeof manifest.repository === "string" ? manifest.repository : manifest.repository?.url,
  ) ?? parseRepository(manifest.homepage);

const readManifest = (entry: BunLicenseEntry): Manifest | null => {
  const path = entry.paths?.[0];

  if (!path) {
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(resolve(path, "package.json"), "utf8")) as Manifest;
  } catch {
    return null;
  }
};

const directDependencies = () => {
  const manifests = fg.sync(["package.json", "apps/*/package.json", "packages/*/package.json"], {
    absolute: true,
    cwd: repoRoot,
  });

  const names = new Set<string>();

  for (const path of manifests) {
    const manifest = JSON.parse(fs.readFileSync(path, "utf8")) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };

    for (const name of [
      ...Object.keys(manifest.dependencies ?? {}),
      ...Object.keys(manifest.devDependencies ?? {}),
    ]) {
      names.add(name);
    }
  }

  return names;
};

const raw = JSON.parse(
  execSync("bun pm licenses list --json", {
    cwd: repoRoot,
    maxBuffer: 1024 * 1024 * 100,
  }).toString(),
) as Record<string, BunLicenseEntry[]>;

const direct = directDependencies();
const groups = new Map<string, AuthorGroup>();

for (const [license, entries] of Object.entries(raw)) {
  for (const entry of entries) {
    if (!direct.has(entry.name)) {
      continue;
    }

    const manifest = readManifest(entry);

    if (manifest?.private) {
      continue;
    }

    const repo = resolveRepository(manifest ?? {});
    const scope = entry.name.startsWith("@") ? entry.name.split("/")[0].slice(1) : "";
    const authorName =
      cleanAuthor(
        typeof manifest?.author === "string" ? manifest.author : manifest?.author?.name,
      ) || cleanAuthor(entry.author);

    const rawOwner = repo?.owner ?? scope;
    const owner = rawOwner.toLowerCase();
    const key = owner ? `owner/${owner}` : `author/${authorName}`;
    const name = owner
      ? (DISPLAY_NAMES[owner] ?? (authorName || prettify(rawOwner)))
      : authorName || "Open Source Community";
    const isGitHub = repo?.host === "github.com" && owner !== "";

    const group = groups.get(key) ?? {
      author: name,
      authorLink: isGitHub
        ? `https://github.com/${rawOwner}`
        : (repo?.url ??
          toPublicUrl(manifest?.homepage) ??
          `https://www.npmjs.com/package/${entry.name}`),
      avatar: isGitHub ? `https://github.com/${owner}.png?size=96` : null,
      packages: [],
    };

    if (isGitHub && !group.avatar) {
      group.avatar = `https://github.com/${owner}.png?size=96`;
      group.authorLink = `https://github.com/${rawOwner}`;
    }

    group.packages.push({ license, name: entry.name });
    groups.set(key, group);
  }
}

const finalData = [...groups.values()]
  .map((group) => {
    const packages = [...new Map(group.packages.map((pkg) => [pkg.name, pkg])).values()].sort(
      (a, b) => a.name.localeCompare(b.name),
    );

    return { ...group, packages };
  })
  .sort((a, b) => b.packages.length - a.packages.length || a.author.localeCompare(b.author));

fs.mkdirSync(dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(finalData, null, 2)}\n`);

console.log(`Done! Processed ${finalData.length} unique authors.`);
