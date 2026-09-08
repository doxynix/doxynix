import { type EntrypointRef, type FileSignals, type RepositoryFile } from "../core/discovery.types";
import { collectFrameworkFactsFromTokens } from "../core/framework-catalog";
import { CONFIDENCE_LEVELS } from "../core/scoring-constants";
import { collectRegexSignals } from "./regex-signals";
import { collectTreeSitterSignals } from "./tree-sitter-signals";

export async function collectTypeScriptSignals(file: RepositoryFile): Promise<FileSignals> {
  const signals = await collectTreeSitterSignals(file);

  if (signals != null) {
    let extraApiSurface = (
      file.content.match(/\b(publicProcedure|protectedProcedure|adminProcedure)\b/g) ?? []
    ).length;
    extraApiSurface += (file.content.match(/\b(GET|POST|PUT|PATCH|DELETE)\b\s*[(:=]/g) ?? [])
      .length;

    const entrypointRefs: EntrypointRef[] = [];
    const entrypointHint =
      /\bcreateServer\b|\bNestFactory\.create\b|\bnew Hono\b|\bexpress\(|\bif\s*\(\s*require\.main\s*===\s*module\s*\)|\bserve\(/.test(
        file.content,
      );

    if (entrypointHint) {
      entrypointRefs.push({
        confidence: 78,
        kind: "runtime",
        path: file.path,
        reason: "runtime bootstrap pattern detected in TypeScript/JavaScript source",
      });
    }

    if (signals.exports > 0 && /\/index\.[cm]?[jt]sx?$/i.test(file.path)) {
      entrypointRefs.push({
        confidence: 66,
        kind: "library",
        path: file.path,
        reason: "exporting index file suggests package public surface",
      });
    }

    const frameworkTokens = new Set<string>();
    [
      /\bnew\s+Hono\s*\(/,
      /\bexpress\s*\(/,
      /\bfastify\s*\(/,
      /\bNestFactory\.create\b/,
      /\bcreateTRPCRouter\b/,
      /\brouter\.(get|post|put|patch|delete)\b/gi,
    ].forEach((pattern) => {
      if (pattern.test(file.content)) {
        frameworkTokens.add(pattern.source);
      }
    });

    const extraFrameworkHints = collectFrameworkFactsFromTokens(
      [...signals.imports, ...Array.from(frameworkTokens)],
      file.path,
      90,
    );

    return {
      ...signals,
      analysisMode: "tree-sitter",
      apiSurface: signals.apiSurface + extraApiSurface,
      confidence: CONFIDENCE_LEVELS.astStructure,
      entrypointHint: signals.entrypointHint || entrypointHint,
      entrypointRefs: [...(signals.entrypointRefs ?? []), ...entrypointRefs],
      frameworkHints: [...(signals.frameworkHints ?? []), ...extraFrameworkHints],
    };
  }

  return collectRegexSignals(file);
}
