/* eslint-disable sonarjs/no-os-command-from-path */
/* eslint-disable sonarjs/slow-regex */
/* eslint-disable sonarjs/cognitive-complexity */
import { execSync } from "child_process";
import fs from "fs";
import path from "path";

const capitalize = (str) => {
  if (!str) return "Open Source Community";
  return str.charAt(0).toUpperCase() + str.slice(1);
};

const MAPPINGS = [
  // Vercel / Next.js ecosystem
  { prefix: "next-auth", name: "NextAuth.js", gh: "nextauthjs" },
  { prefix: "@next-auth/", name: "NextAuth.js", gh: "nextauthjs" },
  { prefix: "next-themes", name: "Paco", gh: "pacocoursey" },
  { prefix: "next-intl", name: "Jan Amann", gh: "amannn" },
  { prefix: "next-sitemap", name: "Vishnu Sankar", gh: "iamvishnusankar" },
  { prefix: "nextjs-toploader", name: "Shri Ganesh Jha", gh: "TheSGJ" },
  { prefix: "nextjs-bundle-analysis", name: "Hashicorp", gh: "hashicorp" },
  { prefix: "next-axiom", name: "Axiom", gh: "axiomhq" },
  { prefix: "eslint-config-next", name: "Vercel", gh: "vercel" },
  { prefix: "@next/", name: "Vercel", gh: "vercel" },
  { prefix: "@vercel/", name: "Vercel", gh: "vercel" },
  { prefix: "@ai-sdk/", name: "Vercel", gh: "vercel" },
  { prefix: "next", name: "Vercel", gh: "vercel" },
  { prefix: "ai", name: "Vercel", gh: "vercel" },

  // Meta / React
  { prefix: "react-hook-form", name: "React Hook Form", gh: "react-hook-form" },
  {
    prefix: "react-arborist",
    name: "Brim Data",
    gh: "brimdata",
  },
  { prefix: "react-codemirror-merge", name: "UIW", gh: "uiwjs" },
  { prefix: "react-hotkeys-hook", name: "Johannes Klauss", gh: "JohannesKlauss" },
  { prefix: "react-resizable-panels", name: "Brian Vaughn", gh: "bvaughn" },
  { prefix: "eslint-plugin-react-compiler", name: "Meta", gh: "facebook" },
  { prefix: "babel-plugin-react-compiler", name: "Meta", gh: "facebook" },
  { prefix: "eslint-plugin-react-hooks", name: "Meta", gh: "facebook" },
  { prefix: "eslint-plugin-react", name: "JSX ESLint", gh: "jsx-eslint" },
  { prefix: "server-only", name: "Meta", gh: "facebook" },
  { prefix: "react-dom", name: "Meta", gh: "facebook" },
  { prefix: "react", name: "Meta", gh: "facebook" },

  // UI, Tailwind, Radix
  { prefix: "@radix-ui/", name: "Radix UI", gh: "radix-ui" },
  { prefix: "lucide-react", name: "Lucide", gh: "lucide-icons" },
  { prefix: "tailwindcss", name: "Tailwind Labs", gh: "tailwindlabs" },
  { prefix: "@tailwindcss/", name: "Tailwind Labs", gh: "tailwindlabs" },
  { prefix: "prettier-plugin-tailwindcss", name: "Tailwind Labs", gh: "tailwindlabs" },
  { prefix: "tailwind-scrollbar", name: "Adoxography", gh: "adoxography" },
  { prefix: "tailwind-merge", name: "Dany Castillo", gh: "dcastil" },
  { prefix: "tw-animate-css", name: "Luca", gh: "Wombosvideo" },
  { prefix: "clsx", name: "Luke Edwards", gh: "lukeed" },

  // Prisma & Databases
  { prefix: "prisma-dbml-generator", name: "Notiz", gh: "notiz-dev" },
  { prefix: "prisma-erd-generator", name: "John Fay", gh: "keonik" },
  { prefix: "prisma-generator-fake-data", name: "Luís Rudge", gh: "luisrudge" },
  { prefix: "prisma-json-schema-generator", name: "Valentin Palkovic", gh: "valentinpalkovic" },
  { prefix: "@prisma/", name: "Prisma", gh: "prisma" },
  { prefix: "prisma", name: "Prisma", gh: "prisma" },
  { prefix: "@zenstackhq/", name: "ZenStack", gh: "zenstackhq" },
  { prefix: "zenstack", name: "ZenStack", gh: "zenstackhq" },
  { prefix: "zod-prisma-types", name: "Chris Hoermann", gh: "chrishoermann" },
  { prefix: "zod", name: "Colin McDonnell", gh: "colinmcdonnell" },
  { prefix: "pg", name: "Brian Carlson", gh: "brianc" },

  // Unified, Remark, Rehype
  { prefix: "remark-", name: "Unified.js", gh: "unifiedjs" },
  { prefix: "rehype-", name: "Unified.js", gh: "unifiedjs" },
  { prefix: "unified", name: "Unified.js", gh: "unifiedjs" },

  // Shiki & Markdown
  { prefix: "@shikijs/", name: "Shiki", gh: "shikijs" },
  { prefix: "shiki", name: "Shiki", gh: "shikijs" },

  // Linting, Types & Dev Tools
  { prefix: "@typescript-eslint/", name: "TypeScript ESLint", gh: "typescript-eslint" },
  { prefix: "@eslint/", name: "ESLint", gh: "eslint" },
  { prefix: "eslint", name: "ESLint", gh: "eslint" },
  { prefix: "prettier", name: "Prettier", gh: "prettier" },
  { prefix: "@types/", name: "DefinitelyTyped", gh: "DefinitelyTyped" },
  { prefix: "typescript", name: "Microsoft", gh: "microsoft" },
  { prefix: "@playwright/", name: "Microsoft", gh: "microsoft" },
  { prefix: "@vitest/", name: "Vitest", gh: "vitest-dev" },
  { prefix: "vitest", name: "Vitest", gh: "vitest-dev" },
  { prefix: "@stryker-mutator/", name: "Stryker Mutator", gh: "stryker-mutator" },
  { prefix: "@commitlint/", name: "commitlint", gh: "conventional-changelog" },
  { prefix: "husky", name: "Typicode", gh: "typicode" },
  { prefix: "lint-staged", name: "lint-staged", gh: "lint-staged" },
  { prefix: "cspell", name: "Street Side Software", gh: "streetsidesoftware" },
  { prefix: "@cspell/", name: "Street Side Software", gh: "streetsidesoftware" },
  { prefix: "@faker-js/", name: "Faker-js", gh: "faker-js" },
  { prefix: "knip", name: "Webpro", gh: "Webpro-nl" },
  { prefix: "webpack-stats-plugin", name: "Nearform Commerce", gh: "FormidableLabs" },

  // General ecosystem
  { prefix: "@tanstack/", name: "TanStack", gh: "tanstack" },
  { prefix: "@trpc/", name: "tRPC", gh: "trpc" },
  { prefix: "trpc-to-openapi", name: "Mario Campa", gh: "mcampa" },
  { prefix: "@octokit/", name: "GitHub", gh: "octokit" },
  { prefix: "@codemirror/", name: "CodeMirror", gh: "codemirror" },
  { prefix: "@lezer/", name: "CodeMirror", gh: "codemirror" },
  { prefix: "@uiw/", name: "UIW", gh: "uiwjs" },
  { prefix: "@scalar/", name: "Scalar", gh: "scalar" },
  { prefix: "@trigger.dev/", name: "Trigger.dev", gh: "triggerdotdev" },
  { prefix: "@upstash/", name: "Upstash", gh: "upstash" },
  { prefix: "@uploadthing/", name: "Ping.gg", gh: "pingdotgg" },
  { prefix: "uploadthing", name: "Ping.gg", gh: "pingdotgg" },
  { prefix: "@react-email/", name: "Resend", gh: "resend" },
  { prefix: "resend", name: "Resend", gh: "resend" },
  { prefix: "@sentry/", name: "Sentry", gh: "getsentry" },
  { prefix: "@mermaid-js/", name: "Mermaid JS", gh: "mermaid-js" },
  { prefix: "mermaid", name: "Mermaid JS", gh: "mermaid-js" },

  // Solo tools & libraries
  { prefix: "zustand", name: "Poimandres", gh: "pmndrs" },
  { prefix: "motion", name: "Matt Perry", gh: "motiondivision" },
  { prefix: "sonner", name: "Emil Kowalski", gh: "emilkowalski" },
  { prefix: "nuqs", name: "47ng", gh: "47ng" },
  { prefix: "cmdk", name: "Paco", gh: "pacocoursey" },
  { prefix: "ably", name: "Ably", gh: "ably" },
  { prefix: "jsonwebtoken", name: "Auth0", gh: "auth0" },
  { prefix: "cookie", name: "jshttp", gh: "jshttp" },
  { prefix: "dotenv", name: "Mot", gh: "motdotla" },
  { prefix: "nodemailer", name: "Andris Reinman", gh: "nodemailer" },
  { prefix: "pino", name: "Pino", gh: "pinojs" },
  { prefix: "posthog-", name: "PostHog", gh: "PostHog" },
  { prefix: "recharts", name: "Recharts", gh: "recharts" },
  { prefix: "ts-node", name: "TypeStrong", gh: "TypeStrong" },
  { prefix: "typedoc", name: "TypeStrong", gh: "TypeStrong" },
  { prefix: "tsx", name: "Hiroki Osame", gh: "privatenumber" },
  { prefix: "@vitejs/", name: "Vite", gh: "vitejs" },
  { prefix: "superjson", name: "Blitz.js", gh: "blitz-js" },
  { prefix: "@hookform/", name: "React Hook Form", gh: "react-hook-form" },
  { prefix: "isbinaryfile", name: "Garen Torikian", gh: "gjtorikian" },
  { prefix: "jscpd", name: "Kucherenko", gh: "kucherenko" },
  { prefix: "simple-git", name: "Steve King", gh: "steveukx" },
  { prefix: "decimal.js", name: "Michael M", gh: "MikeMcl" },
  {
    prefix: "fast-safe-stringify",
    name: "David Mark Clements",
    gh: "davidmarkclements",
  },
  { prefix: "fast-check", name: "Nicolas DUBIEN", gh: "dubzzz" },
  { prefix: "vite-tsconfig-paths", name: "Alec Larson", gh: "aleclarson" },
  { prefix: "openapi-typescript-codegen", name: "Ferdi Koomen", gh: "ferdikoomen" },
  { prefix: "@ianvs/", name: "Ian VanSchooten", gh: "Ianvs" },
  {
    prefix: "parse-github-url",
    name: "Jon Schlinkert",
    gh: "Jonschlinkert",
  },
  {
    prefix: "cross-env",
    name: "Kent C. Dodds",
    gh: "kentcdodds",
  },
  {
    prefix: "@marsidev/",
    name: "Luis Marsiglia",
    gh: "marsidev",
  },
  {
    prefix: "use-debounce",
    name: "Nik",
    gh: "Xnimorz",
  },
  {
    prefix: "detect-language",
    name: "Damian Krzeminski",
    gh: "pirxpilot",
  },
  {
    prefix: "file-saver",
    name: "Eli Grey",
    gh: "eligrey",
  },
  {
    prefix: "browser-image-compression",
    name: "Donald Chan",
    gh: "Donaldcwl",
  },
  {
    prefix: "sloc",
    name: "Markus Kohlhase",
    gh: "flosse",
  },
  {
    prefix: "class-variance-authority",
    name: "Joe-bell",
    gh: "joe-bell",
  },
  {
    prefix: "type-coverage",
    name: "York Yao",
    gh: "plantain",
  },
].sort((a, b) => b.prefix.length - a.prefix.length);

const cleanUrl = (url) => {
  if (!url) return "";

  const rawUrl = typeof url === "string" ? url : url.url || String(url);

  if (typeof rawUrl !== "string" || !rawUrl) return "";

  return rawUrl
    .replace(/^git\+/, "")
    .replace(/\.git$/, "")
    .replace(/\/$/, "");
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

    let cleanedName = rawName;
    let previousName = "";
    let iterations = 0;

    while (cleanedName !== previousName && iterations < 5) {
      previousName = cleanedName;
      cleanedName = cleanedName
        .replace(/\([^)]+\)/g, "")
        .replace(/<[^>]+>/g, "")
        .replace(/\s{2,}/g, " ")
        .trim();
      iterations++;
    }

    cleanedName = cleanedName.replace(/[<>]/g, "");

    if (cleanedName.length > 0) {
      authorName = capitalize(cleanedName);
    }
  }

  authorName = authorName || "Open Source Community";

  if (authorName.toLowerCase() === "meta" || authorName.toLowerCase() === "facebook")
    authorName = "Meta";
  if (authorName.toLowerCase() === "vercel") authorName = "Vercel";

  return {
    authorName,
    authorLink: githubOwner
      ? `https://github.com/${githubOwner}`
      : cleanUrl(pkg.homepage) || cleanUrl(pkg.repository?.url || pkg.repository),
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

  const output = execSync("pnpm licenses list --json", { maxBuffer: 1024 * 1024 * 50 }).toString();
  const rawData = JSON.parse(output);

  const grouped = {};

  Object.entries(rawData).forEach(([licenseType, packages]) => {
    packages.forEach((pkg) => {
      if (myDirectDeps.has(pkg.name)) {
        const enriched = enrichPackageData(pkg);
        const author = enriched.authorName;

        if (!grouped[author]) {
          grouped[author] = {
            author: author,
            avatar: enriched.avatarUrl,
            authorLink: enriched.authorLink,
            packages: [],
          };
        }

        grouped[author].packages.push({
          name: pkg.name,
          license: licenseType,
        });
      }
    });
  });

  const finalData = Object.values(grouped).sort(
    (a, b) => b.packages.length - a.packages.length || a.author.localeCompare(b.author)
  );

  const outputPath = "./src/shared/data/licenses.json";
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(finalData, null, 2));

  console.log(`Done! Processed ${finalData.length} unique authors.`);
} catch (error) {
  console.error("Error:", error.message);
  process.exit(1);
}
