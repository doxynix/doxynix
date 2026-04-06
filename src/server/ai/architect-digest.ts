import type { ProjectMap } from "@/server/ai/schemas";
import type { RepoMetrics, RepositoryFact, RepositoryFinding } from "@/server/ai/types";
import type { DocumentationInputModel } from "@/server/engine/core/types";

type ArchitectDigestSection = {
  confidence: number;
  evidencePaths: string[];
  summary: string[];
  title: string;
  unknowns: string[];
};

export type ArchitectDigest = {
  facts: Array<{
    category: RepositoryFact["category"];
    confidence: RepositoryFact["confidence"];
    evidencePaths: string[];
    id: string;
    title: string;
  }>;
  findings: Array<{
    category: RepositoryFinding["category"];
    evidencePaths: string[];
    id: string;
    score: number;
    severity: RepositoryFinding["severity"];
    summary: string;
    title: string;
  }>;
  metrics: {
    analysisCoverage: RepoMetrics["analysisCoverage"];
    apiSurface: number;
    changeCoupling: Array<{ commits: number; fromPath: string; toPath: string }>;
    churnHotspots: Array<{ commitsInWindow: number; path: string }>;
    complexityScore: number;
    duplicationPercentage: number;
    graphReliability: RepoMetrics["graphReliability"];
    languages: string[];
    onboardingScore: number;
    publicExports: number;
    securityScore: number;
    techDebtScore: number;
    totalLoc: number;
  };
  projectMap: {
    languageBreakdown: ProjectMap["language_breakdown"];
    modules: Array<{
      dependencies: string[];
      path: string;
      responsibility: string;
      type: string;
    }>;
    overview: string;
  };
  sections: {
    api_reference: ArchitectDigestSection & {
      estimatedOperations: number;
      frameworks: string[];
      publicSurfacePaths: string[];
      routeSource: DocumentationInputModel["sections"]["api_reference"]["body"]["sourceOfTruth"];
      routeSourceFiles: string[];
      sampleRoutes: Array<{ method: string; path: string; sourcePath: string }>;
    };
    architecture: ArchitectDigestSection & {
      dependencyCycles: number;
      dependencyHotspots: Array<{ inbound: number; outbound: number; path: string }>;
      graphReliability: {
        resolvedEdges: number;
        unresolvedImportSpecifiers: number;
      };
      modules: Array<{
        apiSurface: number;
        categories: string[];
        exports: number;
        path: string;
      }>;
      orphanModules: string[];
      primaryEntrypoints: string[];
    };
    onboarding: ArchitectDigestSection & {
      apiPaths: string[];
      configPaths: string[];
      firstLookPaths: string[];
      newcomerSteps: string[];
      riskPaths: string[];
    };
    overview: ArchitectDigestSection & {
      configFiles: string[];
      primaryEntrypoints: string[];
      primaryModules: string[];
      repositoryKind: string;
      stackProfile: string[];
    };
    risks: ArchitectDigestSection & {
      derivedScores: DocumentationInputModel["sections"]["risks"]["body"]["derivedScores"];
      findings: Array<{
        evidencePaths: string[];
        id: string;
        score: number;
        severity: string;
        summary: string;
        title: string;
      }>;
      hotspots: Array<{ path: string; score: number }>;
      rawMetrics: DocumentationInputModel["sections"]["risks"]["body"]["rawMetrics"];
    };
  };
};

function limit<T>(items: T[], max: number) {
  return items.slice(0, max);
}

function uniquePaths(paths: string[], max: number) {
  return Array.from(new Set(paths.filter((path) => path.length > 0))).slice(0, max);
}

export function collectArchitectPreferredPaths(digest: ArchitectDigest) {
  return uniquePaths(
    [
      ...digest.sections.overview.primaryEntrypoints,
      ...digest.sections.overview.primaryModules,
      ...digest.sections.architecture.modules.map((module) => module.path),
      ...digest.sections.architecture.orphanModules,
      ...digest.sections.api_reference.routeSourceFiles,
      ...digest.sections.api_reference.publicSurfacePaths,
      ...digest.sections.risks.hotspots.map((hotspot) => hotspot.path),
      ...digest.sections.onboarding.firstLookPaths,
      ...digest.sections.onboarding.apiPaths,
      ...digest.sections.onboarding.configPaths,
      ...digest.facts.flatMap((fact) => fact.evidencePaths),
      ...digest.findings.flatMap((finding) => finding.evidencePaths),
    ],
    36
  );
}

export function buildArchitectDigest(
  documentationInput: DocumentationInputModel,
  metrics: RepoMetrics,
  projectMap: ProjectMap,
  repositoryFacts: RepositoryFact[],
  repositoryFindings: RepositoryFinding[]
): ArchitectDigest {
  return {
    facts: limit(
      repositoryFacts.map((fact) => ({
        category: fact.category,
        confidence: fact.confidence,
        evidencePaths: uniquePaths(
          fact.evidence.map((evidence) => evidence.path),
          4
        ),
        id: fact.id,
        title: fact.title,
      })),
      8
    ),
    findings: limit(
      repositoryFindings.map((finding) => ({
        category: finding.category,
        evidencePaths: uniquePaths(
          finding.evidence.map((evidence) => evidence.path),
          4
        ),
        id: finding.id,
        score: finding.score,
        severity: finding.severity,
        summary: finding.summary,
        title: finding.title,
      })),
      8
    ),
    metrics: {
      analysisCoverage: metrics.analysisCoverage,
      apiSurface: metrics.apiSurface,
      changeCoupling: limit(
        (metrics.changeCoupling ?? []).map((pair) => ({
          commits: pair.commits,
          fromPath: pair.fromPath,
          toPath: pair.toPath,
        })),
        10
      ),
      churnHotspots: limit(
        (metrics.churnHotspots ?? []).map((hotspot) => ({
          commitsInWindow: hotspot.commitsInWindow,
          path: hotspot.path,
        })),
        10
      ),
      complexityScore: metrics.complexityScore,
      duplicationPercentage: metrics.duplicationPercentage,
      graphReliability: metrics.graphReliability,
      languages: metrics.languages.map((language) => language.name).slice(0, 8),
      onboardingScore: metrics.onboardingScore,
      publicExports: metrics.publicExports,
      securityScore: metrics.securityScore,
      techDebtScore: metrics.techDebtScore,
      totalLoc: metrics.totalLoc,
    },
    projectMap: {
      languageBreakdown: projectMap.language_breakdown,
      modules: limit(
        projectMap.modules.map((module) => ({
          dependencies: limit(module.dependencies ?? [], 4),
          path: module.path,
          responsibility: module.responsibility,
          type: module.type,
        })),
        14
      ),
      overview: projectMap.overview,
    },
    sections: {
      api_reference: {
        confidence: documentationInput.sections.api_reference.confidence,
        estimatedOperations:
          documentationInput.sections.api_reference.body.routeInventory.estimatedOperations,
        evidencePaths: uniquePaths(documentationInput.sections.api_reference.evidencePaths, 12),
        frameworks: limit(
          documentationInput.sections.api_reference.body.frameworkFacts.map((fact) => fact.name),
          6
        ),
        publicSurfacePaths: limit(
          documentationInput.sections.api_reference.body.publicSurfacePaths,
          12
        ),
        routeSource: documentationInput.sections.api_reference.body.sourceOfTruth,
        routeSourceFiles: limit(
          documentationInput.sections.api_reference.body.routeInventory.sourceFiles,
          12
        ),
        sampleRoutes: limit(
          documentationInput.sections.api_reference.body.routeInventory.httpRoutes.map((route) => ({
            method: route.method,
            path: route.path,
            sourcePath: route.sourcePath,
          })),
          12
        ),
        summary: documentationInput.sections.api_reference.summary,
        title: documentationInput.sections.api_reference.title,
        unknowns: documentationInput.sections.api_reference.unknowns,
      },
      architecture: {
        confidence: documentationInput.sections.architecture.confidence,
        dependencyCycles: documentationInput.sections.architecture.body.dependencyCycles.length,
        dependencyHotspots: limit(
          documentationInput.sections.architecture.body.dependencyHotspots.map((hotspot) => ({
            inbound: hotspot.inbound,
            outbound: hotspot.outbound,
            path: hotspot.path,
          })),
          10
        ),
        evidencePaths: uniquePaths(documentationInput.sections.architecture.evidencePaths, 12),
        graphReliability: {
          resolvedEdges:
            documentationInput.sections.architecture.body.graphReliability.resolvedEdges,
          unresolvedImportSpecifiers:
            documentationInput.sections.architecture.body.graphReliability
              .unresolvedImportSpecifiers,
        },
        modules: limit(
          documentationInput.sections.architecture.body.modules.map((module) => ({
            apiSurface: module.apiSurface,
            categories: module.categories,
            exports: module.exports,
            path: module.path,
          })),
          12
        ),
        orphanModules: limit(documentationInput.sections.architecture.body.orphanModules, 10),
        primaryEntrypoints: limit(
          documentationInput.sections.architecture.body.primaryEntrypoints,
          10
        ),
        summary: documentationInput.sections.architecture.summary,
        title: documentationInput.sections.architecture.title,
        unknowns: documentationInput.sections.architecture.unknowns,
      },
      onboarding: {
        apiPaths: limit(documentationInput.sections.onboarding.body.apiPaths, 10),
        confidence: documentationInput.sections.onboarding.confidence,
        configPaths: limit(documentationInput.sections.onboarding.body.configPaths, 8),
        evidencePaths: uniquePaths(documentationInput.sections.onboarding.evidencePaths, 12),
        firstLookPaths: limit(documentationInput.sections.onboarding.body.firstLookPaths, 10),
        newcomerSteps: documentationInput.sections.onboarding.body.newcomerSteps,
        riskPaths: limit(documentationInput.sections.onboarding.body.riskPaths, 10),
        summary: documentationInput.sections.onboarding.summary,
        title: documentationInput.sections.onboarding.title,
        unknowns: documentationInput.sections.onboarding.unknowns,
      },
      overview: {
        confidence: documentationInput.sections.overview.confidence,
        configFiles: limit(documentationInput.sections.overview.body.configFiles, 8),
        evidencePaths: uniquePaths(documentationInput.sections.overview.evidencePaths, 12),
        primaryEntrypoints: limit(documentationInput.sections.overview.body.primaryEntrypoints, 10),
        primaryModules: limit(documentationInput.sections.overview.body.primaryModules, 10),
        repositoryKind: documentationInput.sections.overview.body.repositoryKind,
        stackProfile: documentationInput.sections.overview.body.stackProfile,
        summary: documentationInput.sections.overview.summary,
        title: documentationInput.sections.overview.title,
        unknowns: documentationInput.sections.overview.unknowns,
      },
      risks: {
        confidence: documentationInput.sections.risks.confidence,
        derivedScores: documentationInput.sections.risks.body.derivedScores,
        evidencePaths: uniquePaths(documentationInput.sections.risks.evidencePaths, 12),
        findings: limit(
          documentationInput.sections.risks.body.findings.map((finding) => ({
            evidencePaths: uniquePaths(
              finding.evidence.map((evidence) => evidence.path),
              4
            ),
            id: finding.id,
            score: finding.score,
            severity: finding.severity,
            summary: finding.summary,
            title: finding.title,
          })),
          8
        ),
        hotspots: limit(
          documentationInput.sections.risks.body.hotspots.map((hotspot) => ({
            path: hotspot.path,
            score: hotspot.score,
          })),
          10
        ),
        rawMetrics: documentationInput.sections.risks.body.rawMetrics,
        summary: documentationInput.sections.risks.summary,
        title: documentationInput.sections.risks.title,
        unknowns: documentationInput.sections.risks.unknowns,
      },
    },
  };
}
