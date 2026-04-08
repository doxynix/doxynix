import type { RepositoryEvidence } from "../core/discovery.types";
import type { DocumentationInputModel, ReportSectionKind } from "../core/documentation.types";
import type { RepoMetrics, RepositoryFact, RepositoryFinding } from "../core/metrics.types";

export type EvaluationStatus =
  | "manual-review-required"
  | "not-reviewed"
  | "pass"
  | "partial"
  | "fail";

export type EvaluationDimension = {
  notes: string;
  status: EvaluationStatus;
};

export type PrimaryDocEvaluation = {
  notes: string[];
  ready: boolean;
  supportedBySections: ReportSectionKind[];
  tier: "primary";
};

export type SectionEvaluationSummary = {
  confidence: number;
  evidencePathCount: number;
  section: ReportSectionKind;
  title: string;
  unknownHeavy: boolean;
  unknowns: string[];
};

export type LanguageMaturitySnapshot = {
  dominantLanguages: string[];
  parserCoveragePercent: number;
  parserTiers: {
    heuristicFiles: number;
    treeSitterFiles: number;
    typeScriptAstFiles: number;
  };
  parserTierSummary: {
    heuristic: string[];
    treeSitter: string[];
    typeScriptAst: string[];
  };
  strongestTier: "heuristic" | "tree-sitter" | "typescript-ast" | "unknown";
};

export type ManualReviewChecklist = {
  likelyStrengths: string[];
  likelyWeakSpots: string[];
  steps: string[];
};

export type EvaluationSnapshot = {
  generatedAt: string;
  languageMaturity: LanguageMaturitySnapshot;
  manualReview: ManualReviewChecklist;
  primaryDocs: {
    api: PrimaryDocEvaluation;
    architecture: PrimaryDocEvaluation;
    readme: PrimaryDocEvaluation;
  };
  repository: string;
  runtime: {
    architect: {
      reason?: string;
      source: "fallback" | "llm" | "unknown";
      status: "partial" | "success" | "unknown";
    };
    docsFromFallbackAnalysis: boolean;
    writers: {
      api?: "failed" | "fallback" | "llm" | "missing";
      architecture?: "failed" | "fallback" | "llm" | "missing";
      changelog?: "failed" | "fallback" | "llm" | "missing";
      contributing?: "failed" | "fallback" | "llm" | "missing";
      readme?: "failed" | "fallback" | "llm" | "missing";
    };
  };
  sections: Record<ReportSectionKind, SectionEvaluationSummary>;
  snapshot: {
    apiOperations: number;
    frameworks: string[];
    graphReliability: {
      resolvedEdges: number;
      unresolvedImportSpecifiers: number;
    };
    hotspotCount: number;
    languages: string[];
    primaryEntrypoints: string[];
    routeSource:
      | DocumentationInputModel["sections"]["api_reference"]["body"]["sourceOfTruth"]
      | "unknown";
    routeSources: string[];
  };
  targets: {
    architectureUsefulness: EvaluationDimension;
    documentationUsefulness: EvaluationDimension;
    entrypointsCorrectness: EvaluationDimension;
    hotspotUsefulness: EvaluationDimension;
    routeExtraction: EvaluationDimension;
    stackCorrectness: EvaluationDimension;
  };
  topSignals: {
    facts: Array<{ confidence: string; id: string; title: string }>;
    findings: Array<{ id: string; score: number; severity: string; title: string }>;
  };
};

type EvaluationBuildParams = {
  documentationInput: DocumentationInputModel;
  evidence: RepositoryEvidence;
  generatedDocs: GeneratedDocsState;
  metrics: RepoMetrics;
  repository: string;
  repositoryFacts: RepositoryFact[];
  repositoryFindings: RepositoryFinding[];
};

type GeneratedDocsState = {
  analysisRuntime?: {
    architect?: {
      reason?: string;
      source: "fallback" | "llm";
      status: "partial" | "success";
    };
    writers?: {
      api?: "failed" | "fallback" | "llm" | "missing";
      architecture?: "failed" | "fallback" | "llm" | "missing";
      changelog?: "failed" | "fallback" | "llm" | "missing";
      contributing?: "failed" | "fallback" | "llm" | "missing";
      readme?: "failed" | "fallback" | "llm" | "missing";
    };
  };
  generatedApiMarkdown?: string;
  generatedArchitecture?: string;
  generatedChangelog?: string;
  generatedContributing?: string;
  generatedReadme?: string;
};

function emptyDimension(notes: string): EvaluationDimension {
  return {
    notes,
    status: "not-reviewed",
  };
}

function buildPrimaryDocEvaluation(
  ready: boolean,
  supportedBySections: ReportSectionKind[],
  notes: string[]
): PrimaryDocEvaluation {
  return {
    notes,
    ready,
    supportedBySections,
    tier: "primary",
  };
}

function buildSectionEvaluationSummary(
  section:
    | DocumentationInputModel["sections"]["api_reference"]
    | DocumentationInputModel["sections"]["architecture"]
    | DocumentationInputModel["sections"]["onboarding"]
    | DocumentationInputModel["sections"]["overview"]
    | DocumentationInputModel["sections"]["risks"]
): SectionEvaluationSummary {
  return {
    confidence: section.confidence,
    evidencePathCount: section.evidencePaths.length,
    section: section.section,
    title: section.title,
    unknownHeavy: section.confidence < 70 || section.unknowns.length >= 2,
    unknowns: section.unknowns,
  };
}

function hasGeneratedContent(content: string | undefined) {
  return typeof content === "string" && content.trim().length > 0;
}

function buildGeneratedDocPrioritySnapshot(generatedDocs: GeneratedDocsState) {
  return {
    primary: {
      api: hasGeneratedContent(generatedDocs.generatedApiMarkdown),
      architecture: hasGeneratedContent(generatedDocs.generatedArchitecture),
      readme: hasGeneratedContent(generatedDocs.generatedReadme),
    },
    secondary: {
      changelog: hasGeneratedContent(generatedDocs.generatedChangelog),
      contributing: hasGeneratedContent(generatedDocs.generatedContributing),
    },
  };
}

function buildWriterStatusNote(
  status: "failed" | "fallback" | "llm" | "missing" | undefined,
  docName: string
) {
  if (status === "fallback") {
    return `${docName} was generated from deterministic fallback content instead of the primary writer model.`;
  }
  if (status === "llm") {
    return `${docName} was generated by the primary writer model.`;
  }
  if (status === "failed") {
    return `${docName} generation failed and needs manual follow-up.`;
  }
  return `${docName} generation status is unknown or missing.`;
}

function buildLanguageMaturitySnapshot(metrics: RepoMetrics): LanguageMaturitySnapshot {
  const parserCounts = {
    heuristicFiles: metrics.analysisCoverage.heuristicFiles,
    treeSitterFiles: metrics.analysisCoverage.treeSitterFiles,
    typeScriptAstFiles: metrics.analysisCoverage.typeScriptAstFiles,
  };

  const strongestTier =
    parserCounts.typeScriptAstFiles >= parserCounts.treeSitterFiles &&
    parserCounts.typeScriptAstFiles >= parserCounts.heuristicFiles &&
    parserCounts.typeScriptAstFiles > 0
      ? "typescript-ast"
      : parserCounts.treeSitterFiles >= parserCounts.heuristicFiles &&
          parserCounts.treeSitterFiles > 0
        ? "tree-sitter"
        : parserCounts.heuristicFiles > 0
          ? "heuristic"
          : "unknown";

  return {
    dominantLanguages: metrics.languages.slice(0, 5).map((language) => language.name),
    parserCoveragePercent: metrics.analysisCoverage.parserCoveragePercent,
    parserTiers: parserCounts,
    parserTierSummary: metrics.analysisCoverage.languagesByMode,
    strongestTier,
  };
}

function buildManualReviewChecklist(params: {
  documentationInput: DocumentationInputModel;
  evidence: RepositoryEvidence;
  generatedDocs: EvaluationBuildParams["generatedDocs"];
  metrics: RepoMetrics;
  sectionSummaries: EvaluationSnapshot["sections"];
}) {
  const weakSections = Object.values(params.sectionSummaries)
    .filter((section) => section.unknownHeavy)
    .map((section) => section.title);

  const likelyStrengths = [
    ...(params.documentationInput.sections.overview.confidence >= 75
      ? [
          "Overview section already has a strong factual spine for repository kind, stack, and primary entrypoints.",
        ]
      : []),
    ...(params.documentationInput.sections.api_reference.confidence >= 75
      ? [
          "API/reference section looks grounded enough to review as a reliable public surface summary.",
        ]
      : []),
    ...(params.documentationInput.sections.risks.body.findings.length > 0
      ? [
          "Risk section already surfaces concrete findings instead of relying on abstract quality prose.",
        ]
      : []),
  ];

  const likelyWeakSpots = [
    ...(weakSections.length > 0
      ? [`Weak or partial sections detected: ${weakSections.join(", ")}.`]
      : []),
    ...(params.evidence.dependencyGraph.unresolvedImportSpecifiers > 0
      ? ["Dependency graph remains partial because some internal imports are unresolved."]
      : []),
    ...(params.documentationInput.sections.api_reference.body.sourceOfTruth === "unknown"
      ? [
          "API source of truth is weak or missing, so public interface review needs extra attention.",
        ]
      : []),
    ...(params.generatedDocs.analysisRuntime?.architect?.source === "fallback"
      ? [
          "Architect-stage LLM synthesis fell back to canonical section summaries, so review narrative quality strictly.",
        ]
      : []),
    ...(params.generatedDocs.analysisRuntime?.writers?.readme === "failed"
      ? ["README writer failed, so newcomer-facing documentation coverage is incomplete."]
      : []),
    ...(params.generatedDocs.analysisRuntime?.writers?.readme === "fallback"
      ? [
          "README was generated from canonical fallback content, so verify prose polish and onboarding clarity manually.",
        ]
      : []),
    ...(params.generatedDocs.analysisRuntime?.writers?.architecture === "failed"
      ? [
          "ARCHITECTURE writer failed, so architecture narrative must be checked through raw sections/debug artifacts.",
        ]
      : []),
    ...(params.generatedDocs.analysisRuntime?.writers?.architecture === "fallback"
      ? [
          "ARCHITECTURE document was generated from canonical fallback content, so validate narrative depth and structural emphasis manually.",
        ]
      : []),
    ...(params.generatedDocs.analysisRuntime?.writers?.api === "failed"
      ? [
          "API writer failed, so API/reference quality needs manual reconstruction from section inputs and route evidence.",
        ]
      : []),
    ...(params.generatedDocs.analysisRuntime?.writers?.api === "fallback"
      ? [
          "API/reference document was generated from canonical fallback content, so validate formatting and public-surface accuracy manually.",
        ]
      : []),
  ];

  return {
    likelyStrengths:
      likelyStrengths.length > 0
        ? likelyStrengths
        : ["No obvious strength cluster was auto-confirmed; review all primary outputs manually."],
    likelyWeakSpots:
      likelyWeakSpots.length > 0
        ? likelyWeakSpots
        : ["No major weakness cluster was auto-detected; proceed with normal manual review."],
    steps: [
      "Check README first: does it explain the project, stack, entrypoints, and config caveats without guessing?",
      "Check ARCHITECTURE next: does it answer what the project is, what it consists of, where the core is, how logic flows, and where the risks are?",
      "Check API/reference output against route inventory or OpenAPI hints and mark mismatches manually.",
      "Review weak sections and unknown-heavy markers before trusting the generated report as a whole.",
      "Use top findings and top facts as the first manual review anchors instead of reading every debug artifact.",
    ],
  };
}

export function buildEvaluationSnapshot(params: EvaluationBuildParams): EvaluationSnapshot {
  const {
    documentationInput,
    evidence,
    generatedDocs,
    metrics,
    repository,
    repositoryFacts,
    repositoryFindings,
  } = params;

  const primaryEntrypoints = evidence.entrypoints
    .filter((entrypoint) => entrypoint.kind === "library" || entrypoint.kind === "runtime")
    .map((entrypoint) => entrypoint.path);
  const docPriority = buildGeneratedDocPrioritySnapshot(generatedDocs);

  const sections: EvaluationSnapshot["sections"] = {
    api_reference: buildSectionEvaluationSummary(documentationInput.sections.api_reference),
    architecture: buildSectionEvaluationSummary(documentationInput.sections.architecture),
    onboarding: buildSectionEvaluationSummary(documentationInput.sections.onboarding),
    overview: buildSectionEvaluationSummary(documentationInput.sections.overview),
    risks: buildSectionEvaluationSummary(documentationInput.sections.risks),
  };

  const primaryDocs: EvaluationSnapshot["primaryDocs"] = {
    api: buildPrimaryDocEvaluation(
      docPriority.primary.api,
      ["api_reference"],
      [
        docPriority.primary.api
          ? "Primary API artifact was generated."
          : "Primary API artifact is missing and needs manual follow-up.",
        buildWriterStatusNote(generatedDocs.analysisRuntime?.writers?.api, "API"),
        `API section confidence: ${sections.api_reference.confidence}.`,
        ...(sections.api_reference.unknownHeavy
          ? ["API/reference section is unknown-heavy and needs closer manual validation."]
          : []),
      ]
    ),
    architecture: buildPrimaryDocEvaluation(
      docPriority.primary.architecture,
      ["architecture", "risks", "onboarding"],
      [
        docPriority.primary.architecture
          ? "Primary architecture artifact was generated."
          : "Primary architecture artifact is missing and needs manual follow-up.",
        buildWriterStatusNote(generatedDocs.analysisRuntime?.writers?.architecture, "ARCHITECTURE"),
        `Architecture section confidence: ${sections.architecture.confidence}; risks section confidence: ${sections.risks.confidence}.`,
        ...(sections.architecture.unknownHeavy || sections.risks.unknownHeavy
          ? ["Architecture or risks sections are partial, so architecture review should be strict."]
          : []),
      ]
    ),
    readme: buildPrimaryDocEvaluation(
      docPriority.primary.readme,
      ["overview", "architecture"],
      [
        docPriority.primary.readme
          ? "Primary README artifact was generated."
          : "Primary README artifact is missing and needs manual follow-up.",
        buildWriterStatusNote(generatedDocs.analysisRuntime?.writers?.readme, "README"),
        `Overview section confidence: ${sections.overview.confidence}.`,
        ...(sections.overview.unknownHeavy
          ? ["Overview section is unknown-heavy, so README may be weaker than expected."]
          : []),
      ]
    ),
  };

  return {
    generatedAt: new Date().toISOString(),
    languageMaturity: buildLanguageMaturitySnapshot(metrics),
    manualReview: buildManualReviewChecklist({
      documentationInput,
      evidence,
      generatedDocs,
      metrics,
      sectionSummaries: sections,
    }),
    primaryDocs,
    repository,
    runtime: {
      architect: {
        reason: generatedDocs.analysisRuntime?.architect?.reason,
        source: generatedDocs.analysisRuntime?.architect?.source ?? "unknown",
        status: generatedDocs.analysisRuntime?.architect?.status ?? "unknown",
      },
      docsFromFallbackAnalysis: generatedDocs.analysisRuntime?.architect?.source === "fallback",
      writers: generatedDocs.analysisRuntime?.writers ?? {},
    },
    sections,
    snapshot: {
      apiOperations:
        metrics.routeInventory?.estimatedOperations ?? evidence.routeInventory.estimatedOperations,
      frameworks: documentationInput.api.frameworkFacts.map((fact) => fact.name),
      graphReliability: {
        resolvedEdges: evidence.dependencyGraph.resolvedEdges,
        unresolvedImportSpecifiers: evidence.dependencyGraph.unresolvedImportSpecifiers,
      },
      hotspotCount: documentationInput.risks.hotspots.length,
      languages: metrics.languages.map((language) => language.name),
      primaryEntrypoints,
      routeSource: documentationInput.sections.api_reference.body.sourceOfTruth,
      routeSources:
        metrics.routeInventory != null && metrics.routeInventory.sourceFiles.length > 0
          ? metrics.routeInventory.sourceFiles
          : evidence.routeInventory.sourceFiles,
    },
    targets: {
      architectureUsefulness: emptyDimension(
        "Check whether the report explains the main runtime modules, dependency shape, and core boundaries."
      ),
      documentationUsefulness: emptyDimension(
        "Check whether README/ARCHITECTURE/API docs are useful for a newcomer without extra repository browsing."
      ),
      entrypointsCorrectness: emptyDimension(
        "Verify that primary entrypoints/public surfaces match the real project bootstrap or library surface."
      ),
      hotspotUsefulness: emptyDimension(
        "Verify that highlighted hotspots reflect risky or central files rather than incidental config/test noise."
      ),
      routeExtraction: emptyDimension(
        "Verify that extracted routes or OpenAPI-derived operations match the real public API surface."
      ),
      stackCorrectness: emptyDimension(
        "Verify detected frameworks/runtime/tooling against manifests, imports, and repository structure."
      ),
    },
    topSignals: {
      facts: repositoryFacts.slice(0, 5).map((fact) => ({
        confidence: fact.confidence,
        id: fact.id,
        title: fact.title,
      })),
      findings: repositoryFindings.slice(0, 5).map((finding) => ({
        id: finding.id,
        score: finding.score,
        severity: finding.severity,
        title: finding.title,
      })),
    },
  };
}
