import type { FrameworkCategory, FrameworkFact } from "./discovery.types";
import { ProjectPolicy } from "./project-policy";

type FrameworkCatalogEntry = {
  aliases: string[];
  category: FrameworkCategory;
  name: string;
};

export const FRAMEWORK_CATALOG: FrameworkCatalogEntry[] = [
  // --- JS/TS ECOSYSTEM (Frontend & Backend) ---
  { aliases: ["hono", "@hono/"], category: "framework", name: "Hono" },
  { aliases: ["express"], category: "framework", name: "Express" },
  { aliases: ["fastify"], category: "framework", name: "Fastify" },
  { aliases: ["koa", "@koa/"], category: "framework", name: "Koa" },
  { aliases: ["nestjs", "@nestjs/"], category: "framework", name: "NestJS" },
  { aliases: ["next", "next/"], category: "framework", name: "Next.js" },
  { aliases: ["nuxt"], category: "framework", name: "Nuxt.js" },
  { aliases: ["sveltekit", "@sveltejs/kit"], category: "framework", name: "SvelteKit" },
  { aliases: ["@remix-run/"], category: "framework", name: "Remix" },
  { aliases: ["astro"], category: "framework", name: "Astro" },
  { aliases: ["react"], category: "ui", name: "React" },
  { aliases: ["@adonisjs/"], category: "framework", name: "AdonisJS" },
  { aliases: ["solid-js"], category: "ui", name: "SolidJS" },
  { aliases: ["qwik"], category: "ui", name: "Qwik" },
  { aliases: ["preact"], category: "ui", name: "Preact" },
  { aliases: ["alpinejs"], category: "ui", name: "Alpine.js" },
  { aliases: ["vue"], category: "ui", name: "Vue" },
  { aliases: ["svelte"], category: "ui", name: "Svelte" },

  // --- PYTHON ECOSYSTEM ---
  { aliases: ["fastapi"], category: "framework", name: "FastAPI" },
  { aliases: ["flask"], category: "framework", name: "Flask" },
  { aliases: ["django", "django-rest-framework"], category: "framework", name: "Django" },
  { aliases: ["tornado"], category: "framework", name: "Tornado" },
  { aliases: ["pyramid"], category: "framework", name: "Pyramid" },
  { aliases: ["masonite"], category: "framework", name: "Masonite" },

  // --- GO ECOSYSTEM ---
  { aliases: ["gin-gonic/gin", "github.com/gin-gonic/gin"], category: "framework", name: "Gin" },
  {
    aliases: ["gorilla/mux", "github.com/gorilla/mux"],
    category: "framework",
    name: "Gorilla Mux",
  },
  { aliases: ["labstack/echo", "github.com/labstack/echo"], category: "framework", name: "Echo" },
  { aliases: ["gofiber/fiber", "github.com/gofiber/fiber"], category: "framework", name: "Fiber" },
  { aliases: ["beego", "github.com/beego/beego"], category: "framework", name: "Beego" },
  { aliases: ["revel", "github.com/revel/revel"], category: "framework", name: "Revel" },

  // --- RUST ECOSYSTEM ---
  { aliases: ["actix-web"], category: "framework", name: "Actix Web" },
  { aliases: ["axum"], category: "framework", name: "Axum" },
  { aliases: ["rocket"], category: "framework", name: "Rocket" },
  { aliases: ["warp"], category: "framework", name: "Warp" },
  { aliases: ["leptos"], category: "framework", name: "Leptos" },
  { aliases: ["poise"], category: "framework", name: "Poise" },

  // --- JAVA / KOTLIN ECOSYSTEM ---
  {
    aliases: ["spring-boot", "spring-boot-starter", "springframework"],
    category: "framework",
    name: "Spring Boot",
  },
  { aliases: ["io.quarkus", "quarkus"], category: "framework", name: "Quarkus" },
  { aliases: ["io.micronaut", "micronaut"], category: "framework", name: "Micronaut" },
  {
    aliases: ["playframework", "com.typesafe.play"],
    category: "framework",
    name: "Play Framework",
  },
  { aliases: ["ktor", "io.ktor"], category: "framework", name: "Ktor" },

  // --- PHP ECOSYSTEM ---
  { aliases: ["laravel/framework", "laravel/laravel"], category: "framework", name: "Laravel" },
  {
    aliases: ["symfony/symfony", "symfony/framework-bundle"],
    category: "framework",
    name: "Symfony",
  },
  { aliases: ["yiisoft/yii2"], category: "framework", name: "Yii2" },
  { aliases: ["codeigniter4/framework"], category: "framework", name: "CodeIgniter" },
  { aliases: ["cakephp/cakephp"], category: "framework", name: "CakePHP" },

  // --- .NET / C# ---
  {
    aliases: ["microsoft.aspnetcore", "microsoft.extensions.hosting"],
    category: "framework",
    name: "ASP.NET Core",
  },
  { aliases: ["microsoft.entityframeworkcore"], category: "orm", name: "Entity Framework" },

  // --- MOBILE ---
  { aliases: ["react-native"], category: "framework", name: "React Native" },
  { aliases: ["flutter", "io.flutter"], category: "framework", name: "Flutter" },
  { aliases: ["@ionic/core", "@ionic/react"], category: "framework", name: "Ionic" },
  { aliases: ["nativescript"], category: "framework", name: "NativeScript" },

  // --- API / COMMUNICATION ---
  { aliases: ["@trpc/", "trpc"], category: "api", name: "tRPC" },
  { aliases: ["graphql", "@apollo/", "apollo-server"], category: "api", name: "GraphQL" },
  { aliases: ["openapi", "swagger"], category: "api", name: "OpenAPI" },
  { aliases: ["grpc", "@grpc/grpc-js", "google.golang.org/grpc"], category: "api", name: "gRPC" },

  // --- ORM & DATABASE ---
  { aliases: ["prisma"], category: "orm", name: "Prisma" },
  { aliases: ["typeorm"], category: "orm", name: "TypeORM" },
  { aliases: ["sequelize"], category: "orm", name: "Sequelize" },
  { aliases: ["mongoose"], category: "orm", name: "Mongoose" },
  { aliases: ["drizzle-orm"], category: "orm", name: "Drizzle" },
  { aliases: ["sqlalchemy"], category: "orm", name: "SQLAlchemy" },
  { aliases: ["tortoise-orm"], category: "orm", name: "Tortoise ORM" },
  { aliases: ["gorm.io/gorm", "github.com/jinzhu/gorm"], category: "orm", name: "GORM" },
  { aliases: ["diesel"], category: "orm", name: "Diesel" },
  { aliases: ["redis", "ioredis"], category: "database", name: "Redis" },
  { aliases: ["pg", "postgres", "postgresql"], category: "database", name: "PostgreSQL" },
  { aliases: ["mysql", "mysql2"], category: "database", name: "MySQL" },
  { aliases: ["mongodb", "mongo"], category: "database", name: "MongoDB" },
  { aliases: ["sqlite", "sqlite3"], category: "database", name: "SQLite" },
  { aliases: ["@supabase/supabase-js"], category: "database", name: "Supabase" },
  { aliases: ["firebase-admin", "firebase-functions"], category: "database", name: "Firebase" },

  // --- UI / STYLING ---
  { aliases: ["tailwindcss"], category: "ui", name: "Tailwind CSS" },
  { aliases: ["@chakra-ui/react"], category: "ui", name: "Chakra UI" },
  { aliases: ["@mui/material"], category: "ui", name: "Material UI" },
  { aliases: ["styled-components"], category: "ui", name: "Styled Components" },
  { aliases: ["bootstrap"], category: "ui", name: "Bootstrap" },
  { aliases: ["sass", "scss"], category: "ui", name: "Sass" },

  // --- INFRASTRUCTURE & TOOLING ---
  { aliases: ["docker", "dockerfile"], category: "infrastructure", name: "Docker" },
  { aliases: ["terraform"], category: "infrastructure", name: "Terraform" },
  { aliases: ["kubernetes", "k8s", "helm"], category: "infrastructure", name: "Kubernetes" },
  { aliases: ["ansible"], category: "infrastructure", name: "Ansible" },
  { aliases: [".github/workflows", "github actions"], category: "tooling", name: "GitHub Actions" },
  {
    aliases: ["vitest", "jest", "pytest", "junit", "mocha", "cypress", "playwright"],
    category: "testing",
    name: "Testing Frameworks",
  },
];

function escapeRegExp(value: string) {
  return value.replaceAll(/[$()*+.?[\\\]^{|}]/g, "\\$&");
}

function matchesFrameworkAlias(token: string, alias: string) {
  const normalizedAlias = alias.toLowerCase();

  if (/[./@-]/.test(normalizedAlias)) {
    return token.includes(normalizedAlias);
  }

  const escapedAlias = escapeRegExp(normalizedAlias);
  return RegExp(`(^|[^a-z0-9])${escapedAlias}([^a-z0-9]|$)`, "iu").test(token);
}

export function collectFrameworkFactsFromTokens(
  tokens: Iterable<string>,
  source: string,
  baseConfidence: number
) {
  const collected = new Map<string, FrameworkFact>();

  for (const rawToken of tokens) {
    const token = rawToken.toLowerCase();
    for (const entry of FRAMEWORK_CATALOG) {
      if (!entry.aliases.some((alias) => matchesFrameworkAlias(token, alias))) continue;

      const existing = collected.get(entry.name);
      const next: FrameworkFact = {
        category: entry.category,
        confidence: baseConfidence,
        name: entry.name,
        sources: existing == null ? [source] : Array.from(new Set([...existing.sources, source])),
      };

      if (existing == null || existing.confidence < next.confidence) {
        collected.set(entry.name, next);
      } else {
        existing.sources = next.sources;
      }
    }
  }

  return Array.from(collected.values()).sort((left, right) => right.confidence - left.confidence);
}

export function mergeFrameworkFacts(facts: FrameworkFact[]) {
  const merged = new Map<string, FrameworkFact>();

  for (const fact of facts) {
    const existing = merged.get(fact.name);
    if (existing == null) {
      merged.set(fact.name, { ...fact, sources: Array.from(new Set(fact.sources)) });
      continue;
    }

    existing.confidence = Math.max(existing.confidence, fact.confidence);
    existing.sources = Array.from(new Set([...existing.sources, ...fact.sources]));
  }

  return Array.from(merged.values()).sort((left, right) => right.confidence - left.confidence);
}

function countCoreSources(fact: FrameworkFact) {
  return Array.from(
    new Set(fact.sources.filter((source) => ProjectPolicy.isFrameworkFactSource(source)))
  ).length;
}

function hasManifestOnlySources(fact: FrameworkFact) {
  return (
    fact.sources.length > 0 &&
    fact.sources.every(
      (source) =>
        ProjectPolicy.isConfigFile(source) ||
        ProjectPolicy.isDocsFile(source) ||
        ProjectPolicy.isInfraFile(source) ||
        ProjectPolicy.isTestFile(source) ||
        ProjectPolicy.isToolingFile(source)
    )
  );
}

export function isCoreRepositoryFrameworkFact(fact: FrameworkFact) {
  const coreSourceCount = countCoreSources(fact);
  if (coreSourceCount >= 2) return true;
  if (coreSourceCount >= 1 && (fact.category === "api" || fact.category === "framework"))
    return true;
  return false;
}

export function selectRepositoryFrameworkFacts(facts: FrameworkFact[]) {
  const mergedFacts = mergeFrameworkFacts(facts);
  const coreFacts = mergedFacts.filter((fact) => isCoreRepositoryFrameworkFact(fact));
  if (coreFacts.length > 0) {
    return coreFacts;
  }

  const filteredFallback = mergedFacts.filter((fact) => !hasManifestOnlySources(fact));
  return filteredFallback.length > 0 ? filteredFallback : mergedFacts;
}
