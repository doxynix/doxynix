import { createTRPCRouter } from "@/server/core/trpc/init";

import { analysisCoreRouter } from "./analysis-core.router";
import { analysisDocsRouter } from "./analysis-docs.router";
import { analysisPrFixesRouter } from "./analysis-pr-fixes.router";
import { analysisRepoRouter } from "./analysis-repo.router";

/**
 * Composition root only. The sub-routers are spread rather than nested so every
 * procedure keeps the flat `analysis.<name>` path the typed client calls.
 */
export const analysisRouter = createTRPCRouter({
  ...analysisCoreRouter,
  ...analysisDocsRouter,
  ...analysisPrFixesRouter,
  ...analysisRepoRouter,
});
