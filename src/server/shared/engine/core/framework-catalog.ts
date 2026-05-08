import { escapeRegExp, uniq } from "es-toolkit";

import type { FrameworkFact } from "./discovery.types";
import { ProjectPolicy } from "./project-policy";
import { FRAMEWORK_CATALOG } from "./project-policy-rules";

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
        sources: existing == null ? [source] : uniq([...existing.sources, source]),
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

function mergeFrameworkFacts(facts: FrameworkFact[]) {
  const merged = new Map<string, FrameworkFact>();

  for (const fact of facts) {
    const existing = merged.get(fact.name);
    if (existing == null) {
      merged.set(fact.name, { ...fact, sources: Array.from(new Set(fact.sources)) });
      continue;
    }

    existing.confidence = Math.max(existing.confidence, fact.confidence);
    existing.sources = uniq([...existing.sources, ...fact.sources]);
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

function isCoreRepositoryFrameworkFact(fact: FrameworkFact) {
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
