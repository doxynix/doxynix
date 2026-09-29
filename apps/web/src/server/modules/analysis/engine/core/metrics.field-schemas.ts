import * as z from "zod";

import type { OpenApiInventory } from "../extractors/openapi-inventory";
import type { TsStaticHint } from "../extractors/ts-static-hints";
import type {
  ChangeCouplingRef,
  FileCategoryBreakdownItem,
  GraphPreviewEdge,
} from "./discovery.types";
import type { DocumentationInputModel } from "./documentation.types";
import type { ChurnHotspot } from "./metrics.types";

/**
 * The nine `RepoMetricsSchema` fields that used to be `z.unknown().optional()`.
 *
 * Every one is `.optional()` because the engine omits any of them for a repository
 * that has no such signal, and `metrics.schemas.test.ts` pins a minimal payload that
 * carries none of the nine.
 *
 * Field names are transcribed from the source types, not guessed — the unions are
 * spelled out rather than widened to `z.string()` so a typo'd category becomes a
 * parse failure instead of a silent pass-through.
 */

export const ChangeCouplingSchema: z.ZodType<ChangeCouplingRef> = z.looseObject({
  commits: z.number(),
  fromPath: z.string(),
  toPath: z.string(),
});

export const ChurnHotspotSchema: z.ZodType<ChurnHotspot> = z.looseObject({
  churnScore: z.number(),
  commitsInWindow: z.number(),
  path: z.string(),
});

export const EntrypointKindSchema = z.enum([
  "benchmark",
  "infra",
  "library",
  "runtime",
  "test",
  "tooling",
]);

export const EntrypointRefSchema = z.looseObject({
  confidence: z.number(),
  kind: EntrypointKindSchema,
  path: z.string(),
  reason: z.string(),
});

export const FrameworkCategorySchema = z.enum([
  "api",
  "cloud",
  "database",
  "framework",
  "infrastructure",
  "orm",
  "runtime",
  "testing",
  "tooling",
  "ui",
]);

export const FileCategoryBreakdownItemSchema: z.ZodType<FileCategoryBreakdownItem> = z.looseObject({
  category: z.enum([
    "asset",
    "benchmark",
    "config",
    "docs",
    "generated",
    "infra",
    "runtime-source",
    "test",
    "tooling",
  ]),
  count: z.number(),
});

export const FrameworkFactSchema = z.looseObject({
  category: FrameworkCategorySchema,
  confidence: z.number(),
  name: z.string(),
  sources: z.array(z.string()),
});

export const GraphPreviewEdgeSchema: z.ZodType<GraphPreviewEdge> = z.looseObject({
  fromPath: z.string(),
  toPath: z.string(),
  weight: z.number(),
});

export const TsStaticHintSchema: z.ZodType<TsStaticHint> = z.looseObject({
  detail: z.string(),
  kind: z.enum(["explicit-any", "long-function", "many-params"]),
  line: z.number().optional(),
  path: z.string(),
});

export const OpenApiInventorySchema: z.ZodType<OpenApiInventory> = z.looseObject({
  estimatedOperations: z.number(),
  pathPatterns: z.array(z.string()),
  sourceFiles: z.array(z.string()),
});

/**
 * `DocumentationInputModel` is a ~50-field, five-level-deep engine payload: its
 * own `sections` are keyed by document section and each carries a distinct body
 * type. Transcribing it would be roughly 150 lines of schema that nothing in the
 * read path ever inspects, and any drift would fail every read of every metrics
 * blob. `z.custom` keeps the precise type link at zero runtime cost, which is the
 * honest trade for a field this schema only ever passes through.
 */
export const DocumentationInputSchema = z.custom<DocumentationInputModel>(
  (value) => value != null && typeof value === "object",
  { message: "documentationInput must be an object" },
);
