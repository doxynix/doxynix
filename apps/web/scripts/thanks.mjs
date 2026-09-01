/* eslint-disable sonarjs/no-os-command-from-path */
/* eslint-disable sonarjs/slow-regex */
/* eslint-disable sonarjs/cognitive-complexity */
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const capitalize = (str) => {
  if (!str) {
    return "Open Source Community";
  }
  return str.charAt(0).toUpperCase() + str.slice(1);
};

const MAPPINGS = [
  // Vercel / Next.js ecosystem
  { gh: "nextauthjs", name: "NextAuth.js", prefix: "next-auth" },
  { gh: "nextauthjs", name: "NextAuth.js", prefix: "@next-auth/" },
  { gh: "pacocoursey", name: "Paco", prefix: "next-themes" },
  { gh: "amannn", name: "Jan Amann", prefix: "next-intl" },
  { gh: "iamvishnusankar", name: "Vishnu Sankar", prefix: "next-sitemap" },
  { gh: "TheSGJ", name: "Shri Ganesh Jha", prefix: "nextjs-toploader" },
  { gh: "hashicorp", name: "Hashicorp", prefix: "nextjs-bundle-analysis" },
  { gh: "axiomhq", name: "Axiom", prefix: "next-axiom" },
  { gh: "vercel", name: "Vercel", prefix: "eslint-config-next" },
  { gh: "vercel", name: "Vercel", prefix: "@next/" },
  { gh: "vercel", name: "Vercel", prefix: "@vercel/" },
  { gh: "vercel", name: "Vercel", prefix: "@ai-sdk/" },
  { gh: "vercel", name: "Vercel", prefix: "next" },
  { gh: "vercel", name: "Vercel", prefix: "ai" },

  // Meta / React
  { gh: "react-hook-form", name: "React Hook Form", prefix: "react-hook-form" },
  {
    gh: "brimdata",
    name: "Brim Data",
    prefix: "react-arborist",
  },
  { gh: "uiwjs", name: "UIW", prefix: "react-codemirror-merge" },
  { gh: "JohannesKlauss", name: "Johannes Klauss", prefix: "react-hotkeys-hook" },
  { gh: "bvaughn", name: "Brian Vaughn", prefix: "react-resizable-panels" },
  { gh: "facebook", name: "Meta", prefix: "eslint-plugin-react-compiler" },
  { gh: "facebook", name: "Meta", prefix: "babel-plugin-react-compiler" },
  { gh: "facebook", name: "Meta", prefix: "eslint-plugin-react-hooks" },
  { gh: "jsx-eslint", name: "JSX ESLint", prefix: "eslint-plugin-react" },
  { gh: "facebook", name: "Meta", prefix: "server-only" },
  { gh: "facebook", name: "Meta", prefix: "react-dom" },
  { gh: "facebook", name: "Meta", prefix: "react" },

  // UI, Tailwind, Radix
  { gh: "radix-ui", name: "Radix UI", prefix: "@radix-ui/" },
  { gh: "lucide-icons", name: "Lucide", prefix: "lucide-react" },
  { gh: "tailwindlabs", name: "Tailwind Labs", prefix: "tailwindcss" },
  { gh: "tailwindlabs", name: "Tailwind Labs", prefix: "@tailwindcss/" },
  { gh: "tailwindlabs", name: "Tailwind Labs", prefix: "prettier-plugin-tailwindcss" },
  { gh: "adoxography", name: "Adoxography", prefix: "tailwind-scrollbar" },
  { gh: "dcastil", name: "Dany Castillo", prefix: "tailwind-merge" },
  { gh: "Wombosvideo", name: "Luca", prefix: "tw-animate-css" },
  { gh: "lukeed", name: "Luke Edwards", prefix: "clsx" },
  { gh: "xyflow", name: "Xyflow", prefix: "@xyflow" },

  // Prisma & Databases
  { gh: "notiz-dev", name: "Notiz", prefix: "prisma-dbml-generator" },
  { gh: "keonik", name: "John Fay", prefix: "prisma-erd-generator" },
  { gh: "luisrudge", name: "Luís Rudge", prefix: "prisma-generator-fake-data" },
  { gh: "47ng", name: "47ng", prefix: "prisma-field-encryption" },
  { gh: "valentinpalkovic", name: "Valentin Palkovic", prefix: "prisma-json-schema-generator" },
  { gh: "prisma", name: "Prisma", prefix: "@prisma/" },
  { gh: "prisma", name: "Prisma", prefix: "prisma" },
  { gh: "zenstackhq", name: "ZenStack", prefix: "@zenstackhq/" },
  { gh: "zenstackhq", name: "ZenStack", prefix: "zenstack" },
  { gh: "chrishoermann", name: "Chris Hoermann", prefix: "zod-prisma-types" },
  { gh: "colinmcdonnell", name: "Colin McDonnell", prefix: "zod" },
  { gh: "brianc", name: "Brian Carlson", prefix: "pg" },

  // Unified, Remark, Rehype
  { gh: "unifiedjs", name: "Unified.js", prefix: "remark-" },
  { gh: "unifiedjs", name: "Unified.js", prefix: "rehype-" },
  { gh: "unifiedjs", name: "Unified.js", prefix: "unified" },

  // Shiki & Markdown
  { gh: "shikijs", name: "Shiki", prefix: "@shikijs/" },
  { gh: "shikijs", name: "Shiki", prefix: "shiki" },

  // Linting, Types & Dev Tools
  { gh: "typescript-eslint", name: "TypeScript ESLint", prefix: "@typescript-eslint/" },
  { gh: "eslint", name: "ESLint", prefix: "@eslint/" },
  { gh: "eslint", name: "ESLint", prefix: "eslint" },
  { gh: "prettier", name: "Prettier", prefix: "prettier" },
  { gh: "DefinitelyTyped", name: "DefinitelyTyped", prefix: "@types/" },
  { gh: "microsoft", name: "Microsoft", prefix: "typescript" },
  { gh: "microsoft", name: "Microsoft", prefix: "@playwright/" },
  { gh: "vitest-dev", name: "Vitest", prefix: "@vitest/" },
  { gh: "vitest-dev", name: "Vitest", prefix: "vitest" },
  { gh: "stryker-mutator", name: "Stryker Mutator", prefix: "@stryker-mutator/" },
  { gh: "conventional-changelog", name: "commitlint", prefix: "@commitlint/" },
  { gh: "typicode", name: "Typicode", prefix: "husky" },
  { gh: "lint-staged", name: "lint-staged", prefix: "lint-staged" },
  { gh: "streetsidesoftware", name: "Street Side Software", prefix: "cspell" },
  { gh: "streetsidesoftware", name: "Street Side Software", prefix: "@cspell/" },
  { gh: "faker-js", name: "Faker-js", prefix: "@faker-js/" },
  { gh: "Webpro-nl", name: "Webpro", prefix: "knip" },
  { gh: "FormidableLabs", name: "Nearform Commerce", prefix: "webpack-stats-plugin" },
  { gh: "prettier", name: "Prettier", prefix: "eslint-config-prettier" },
  { gh: "SonarSource", name: "Sonar", prefix: "eslint-plugin-sonarjs" },

  // General ecosystem
  { gh: "tanstack", name: "TanStack", prefix: "@tanstack/" },
  { gh: "trpc", name: "tRPC", prefix: "@trpc/" },
  { gh: "mcampa", name: "Mario Campa", prefix: "trpc-to-openapi" },
  { gh: "octokit", name: "GitHub", prefix: "@octokit/" },
  { gh: "codemirror", name: "CodeMirror", prefix: "@codemirror/" },
  { gh: "codemirror", name: "CodeMirror", prefix: "@lezer/" },
  { gh: "uiwjs", name: "UIW", prefix: "@uiw/" },
  { gh: "scalar", name: "Scalar", prefix: "@scalar/" },
  { gh: "triggerdotdev", name: "Trigger.dev", prefix: "@trigger.dev/" },
  { gh: "upstash", name: "Upstash", prefix: "@upstash/" },
  { gh: "pingdotgg", name: "Ping.gg", prefix: "@uploadthing/" },
  { gh: "pingdotgg", name: "Ping.gg", prefix: "uploadthing" },
  { gh: "resend", name: "Resend", prefix: "@react-email/" },
  { gh: "resend", name: "Resend", prefix: "resend" },
  { gh: "getsentry", name: "Sentry", prefix: "@sentry/" },
  { gh: "mermaid-js", name: "Mermaid JS", prefix: "@mermaid-js/" },
  { gh: "mermaid-js", name: "Mermaid JS", prefix: "mermaid" },

  // Solo tools & libraries
  { gh: "pmndrs", name: "Poimandres", prefix: "zustand" },
  { gh: "motiondivision", name: "Matt Perry", prefix: "motion" },
  { gh: "emilkowalski", name: "Emil Kowalski", prefix: "sonner" },
  { gh: "47ng", name: "47ng", prefix: "nuqs" },
  { gh: "pacocoursey", name: "Paco", prefix: "cmdk" },
  { gh: "ably", name: "Ably", prefix: "ably" },
  { gh: "auth0", name: "Auth0", prefix: "jsonwebtoken" },
  { gh: "jshttp", name: "jshttp", prefix: "cookie" },
  { gh: "motdotla", name: "Mot", prefix: "dotenv" },
  { gh: "nodemailer", name: "Andris Reinman", prefix: "nodemailer" },
  { gh: "pinojs", name: "Pino", prefix: "pino" },
  { gh: "PostHog", name: "PostHog", prefix: "posthog-" },
  { gh: "recharts", name: "Recharts", prefix: "recharts" },
  { gh: "TypeStrong", name: "TypeStrong", prefix: "ts-node" },
  { gh: "TypeStrong", name: "TypeStrong", prefix: "typedoc" },
  { gh: "privatenumber", name: "Hiroki Osame", prefix: "tsx" },
  { gh: "vitejs", name: "Vite", prefix: "@vitejs/" },
  { gh: "blitz-js", name: "Blitz.js", prefix: "superjson" },
  { gh: "react-hook-form", name: "React Hook Form", prefix: "@hookform/" },
  { gh: "gjtorikian", name: "Garen Torikian", prefix: "isbinaryfile" },
  { gh: "kucherenko", name: "Kucherenko", prefix: "jscpd" },
  { gh: "steveukx", name: "Steve King", prefix: "simple-git" },
  { gh: "MikeMcl", name: "Michael M", prefix: "decimal.js" },
  {
    gh: "davidmarkclements",
    name: "David Mark Clements",
    prefix: "fast-safe-stringify",
  },
  { gh: "dubzzz", name: "Nicolas DUBIEN", prefix: "fast-check" },
  { gh: "aleclarson", name: "Alec Larson", prefix: "vite-tsconfig-paths" },
  { gh: "ferdikoomen", name: "Ferdi Koomen", prefix: "openapi-typescript-codegen" },
  { gh: "Ianvs", name: "Ian VanSchooten", prefix: "@ianvs/" },
  {
    gh: "Jonschlinkert",
    name: "Jon Schlinkert",
    prefix: "parse-github-url",
  },
  {
    gh: "kentcdodds",
    name: "Kent C. Dodds",
    prefix: "cross-env",
  },
  {
    gh: "marsidev",
    name: "Luis Marsiglia",
    prefix: "@marsidev/",
  },
  {
    gh: "Xnimorz",
    name: "Nik",
    prefix: "use-debounce",
  },
  {
    gh: "pirxpilot",
    name: "Damian Krzeminski",
    prefix: "detect-language",
  },
  {
    gh: "eligrey",
    name: "Eli Grey",
    prefix: "file-saver",
  },
  {
    gh: "Donaldcwl",
    name: "Donald Chan",
    prefix: "browser-image-compression",
  },
  {
    gh: "flosse",
    name: "Markus Kohlhase",
    prefix: "sloc",
  },
  {
    gh: "joe-bell",
    name: "Joe-bell",
    prefix: "class-variance-authority",
  },
  {
    gh: "plantain",
    name: "York Yao",
    prefix: "type-coverage",
  },
].sort((a, b) => b.prefix.length - a.prefix.length);

const cleanUrl = (url) => {
  if (!url) {
    return "";
  }

  const rawUrl = typeof url === "string" ? url : url.url || String(url);

  if (typeof rawUrl !== "string" || !rawUrl) {
    return "";
  }

  return rawUrl
    .replace(/^git\+/, "")
    .replace(/\.git$/, "")
    .replace(/\/$/, "");
};

const toPublicUrl = (url) => {
  const cleaned = cleanUrl(url);

  try {
    const parsed = new URL(cleaned);
    return parsed.protocol === "https:" || parsed.protocol === "http:"
      ? parsed.toString().replace(/\/$/, "")
      : "";
  } catch {
    return "";
  }
};

const sanitizeAuthorName = (rawName) => {
  if (!rawName) {
    return "";
  }

  let cleanedName = String(rawName)
    .replaceAll(/\([^)]+\)/g, "")
    .replaceAll(/<[^>]*>/g, "")
    .replaceAll(/\b[^\s@]+@[^\s@]+\.[^\s@]+\b/g, "")
    .replaceAll(/[<>]/g, "")
    .replaceAll(/\s{2,}/g, " ")
    .trim();

  cleanedName = cleanedName.replaceAll(/[^a-zA-Z0-9\s.'"-]/g, "").trim();

  return cleanedName;
};

function enrichPackageData(pkg) {
  let authorName = "";
  let githubOwner = "";

  for (const data of MAPPINGS) {
    if (pkg.name === data.prefix || pkg.name.startsWith(data.prefix)) {
      authorName = data.name;
      githubOwner = data.gh;
      break;
    }
  }

  if (!authorName) {
    const repoUrl = cleanUrl(pkg.repository?.url || pkg.repository || pkg.homepage || "");
    const ghMatch = repoUrl.match(/(?:github\.com[/:]|github:)([^/.]+)/i);
    if (ghMatch) {
      const extracted = ghMatch[1];
      if (!["packages", "repos", "tree", "blob", "www"].includes(extracted.toLowerCase())) {
        githubOwner = extracted;
        authorName = capitalize(extracted);
      }
    }
  }

  if (!authorName && pkg.author) {
    const rawName =
      typeof pkg.author === "object" ? String(pkg.author?.name ?? "") : String(pkg.author ?? "");

    const cleanedName = sanitizeAuthorName(rawName);

    if (cleanedName.length > 0) {
      authorName = capitalize(cleanedName);
    }
  }

  authorName = authorName || "Open Source Community";

  if (authorName.toLowerCase() === "meta" || authorName.toLowerCase() === "facebook") {
    authorName = "Meta";
  }
  if (authorName.toLowerCase() === "vercel") {
    authorName = "Vercel";
  }

  return {
    authorLink: githubOwner
      ? `https://github.com/${githubOwner}`
      : toPublicUrl(pkg.homepage) || toPublicUrl(pkg.repository?.url || pkg.repository),
    authorName,
    avatarUrl: githubOwner ? `https://github.com/${githubOwner}.png?size=96` : null,
    description: pkg.description || "Essential dependency",
  };
}

try {
  const pkgJson = JSON.parse(fs.readFileSync("./package.json", "utf-8"));
  const myDirectDeps = new Set([
    ...Object.keys(pkgJson.dependencies || {}),
    ...Object.keys(pkgJson.devDependencies || {}),
  ]);

  const output = execSync("bun licenses list --json", { maxBuffer: 1024 * 1024 * 50 }).toString();
  const rawData = JSON.parse(output);

  const grouped = Object.create(null);

  Object.entries(rawData).forEach(([licenseType, packages]) => {
    packages.forEach((pkg) => {
      if (myDirectDeps.has(pkg.name)) {
        const enriched = enrichPackageData(pkg);
        const author = enriched.authorName;

        if (!grouped[author]) {
          grouped[author] = {
            author: author,
            authorLink: enriched.authorLink,
            avatar: enriched.avatarUrl,
            packages: [],
          };
        }

        grouped[author].packages.push({
          license: licenseType,
          name: pkg.name,
        });
      }
    });
  });

  const finalData = Object.values(grouped).sort(
    (a, b) => b.packages.length - a.packages.length || a.author.localeCompare(b.author),
  );

  const outputPath = "./src/shared/data/licenses.json";
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(finalData, null, 2));

  console.log(`Done! Processed ${finalData.length} unique authors.`);
} catch (error) {
  console.error("Error:", error.message);
  process.exit(1);
}
