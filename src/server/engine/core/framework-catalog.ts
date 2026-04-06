import { FileClassifier } from "./file-classifier";
import type { FrameworkCategory, FrameworkFact } from "./types";

type FrameworkCatalogEntry = {
  aliases: string[];
  category: FrameworkCategory;
  name: string;
};

export const FRAMEWORK_CATALOG: FrameworkCatalogEntry[] = [
  { aliases: ["hono", "@hono/"], category: "framework", name: "Hono" },
  { aliases: ["express"], category: "framework", name: "Express" },
  { aliases: ["fastify"], category: "framework", name: "Fastify" },
  { aliases: ["koa", "@koa/"], category: "framework", name: "Koa" },
  { aliases: ["nestjs", "@nestjs/"], category: "framework", name: "NestJS" },
  { aliases: ["next", "next/"], category: "framework", name: "Next.js" },
  { aliases: ["nuxt"], category: "framework", name: "Nuxt.js" },
  { aliases: ["sveltekit", "@sveltejs/kit"], category: "framework", name: "SvelteKit" },
  { aliases: ["react"], category: "ui", name: "React" },
  { aliases: ["vue"], category: "ui", name: "Vue" },
  { aliases: ["svelte"], category: "ui", name: "Svelte" },
  { aliases: ["fastapi"], category: "framework", name: "FastAPI" },
  { aliases: ["flask"], category: "framework", name: "Flask" },
  { aliases: ["django"], category: "framework", name: "Django" },
  { aliases: ["gin-gonic/gin", "github.com/gin-gonic/gin"], category: "framework", name: "Gin" },
  {
    aliases: ["gorilla/mux", "github.com/gorilla/mux"],
    category: "framework",
    name: "Gorilla Mux",
  },
  { aliases: ["actix-web"], category: "framework", name: "Actix Web" },
  { aliases: ["axum"], category: "framework", name: "Axum" },
  {
    aliases: ["spring-boot", "spring-boot-starter", "springframework"],
    category: "framework",
    name: "Spring Boot",
  },
  { aliases: ["laravel/framework"], category: "framework", name: "Laravel" },
  { aliases: ["symfony"], category: "framework", name: "Symfony" },
  { aliases: ["microsoft.aspnetcore"], category: "framework", name: "ASP.NET Core" },
  { aliases: ["@trpc/", "trpc"], category: "api", name: "tRPC" },
  { aliases: ["graphql", "@apollo/", "apollo-server"], category: "api", name: "GraphQL" },
  { aliases: ["openapi", "swagger"], category: "api", name: "OpenAPI" },
  { aliases: ["prisma"], category: "orm", name: "Prisma" },
  { aliases: ["typeorm"], category: "orm", name: "TypeORM" },
  { aliases: ["sequelize"], category: "orm", name: "Sequelize" },
  { aliases: ["mongoose"], category: "orm", name: "Mongoose" },
  { aliases: ["drizzle-orm"], category: "orm", name: "Drizzle" },
  { aliases: ["sqlalchemy"], category: "orm", name: "SQLAlchemy" },
  { aliases: ["microsoft.entityframeworkcore"], category: "orm", name: "Entity Framework" },
  { aliases: ["redis", "ioredis"], category: "database", name: "Redis" },
  { aliases: ["pg", "postgres", "postgresql"], category: "database", name: "PostgreSQL" },
  { aliases: ["mysql", "mysql2"], category: "database", name: "MySQL" },
  { aliases: ["mongodb", "mongo"], category: "database", name: "MongoDB" },
  { aliases: ["docker"], category: "infrastructure", name: "Docker" },
  { aliases: ["terraform"], category: "infrastructure", name: "Terraform" },
  { aliases: ["kubernetes", "k8s"], category: "infrastructure", name: "Kubernetes" },
  { aliases: [".github/workflows", "github actions"], category: "tooling", name: "GitHub Actions" },
  { aliases: ["tailwindcss"], category: "ui", name: "Tailwind CSS" },
  { aliases: ["vitest", "pytest", "junit"], category: "testing", name: "Testing Frameworks" },
];

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function matchesFrameworkAlias(token: string, alias: string) {
  const normalizedAlias = alias.toLowerCase();

  if (/[@./-]/.test(normalizedAlias)) {
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
    new Set(fact.sources.filter((source) => FileClassifier.isCoreFrameworkFactSource(source)))
  ).length;
}

function hasManifestOnlySources(fact: FrameworkFact) {
  return (
    fact.sources.length > 0 &&
    fact.sources.every(
      (source) =>
        FileClassifier.isConfigFile(source) ||
        FileClassifier.isDocsFile(source) ||
        FileClassifier.isInfraFile(source) ||
        FileClassifier.isTestFile(source) ||
        FileClassifier.isToolingFile(source)
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
