import type { Repo } from "@prisma/client";

import type {
  DocumentationInputModel,
  HotspotSignal,
  ModuleArchitectureSummary,
  ReportSectionInput,
} from "@/server/shared/engine/core/types";

// function hasText(value: string | undefined | null) {
//   return typeof value === "string" && value.trim().length > 0;
// }

function uniqueItems(items: string[], limit?: number) {
  const deduped = Array.from(
    new Set(items.map((item) => item.trim()).filter((item) => item.length > 0))
  );
  return typeof limit === "number" ? deduped.slice(0, limit) : deduped;
}

function renderBulletList(items: string[], emptyState: string, limit?: number) {
  const lines = uniqueItems(items, limit);
  if (lines.length === 0) return `- ${emptyState}`;
  return lines.map((item) => `- ${item}`).join("\n");
}

function renderSectionSummary<TBody>(
  section: ReportSectionInput<TBody>,
  emptyState: string,
  limit = 6
) {
  return renderBulletList(section.summary, emptyState, limit);
}

function renderModules(modules: ModuleArchitectureSummary[], emptyState: string, limit = 10) {
  const lines = modules.slice(0, limit).map((module) => {
    const categories =
      module.categories.length > 0
        ? module.categories.filter((category) => category !== "runtime-source")
        : [];
    const categorySuffix = categories.length > 0 ? `; categories: ${categories.join(", ")}` : "";
    return `\`${module.path}\` (exports: ${module.exports}, api surface: ${module.apiSurface}, parse tier: ${module.parseTier}${categorySuffix})`;
  });
  return renderBulletList(lines, emptyState);
}

function renderHotspots(hotspots: HotspotSignal[], emptyState: string, limit = 8) {
  const lines = hotspots
    .slice(0, limit)
    .map(
      (hotspot) =>
        `\`${hotspot.path}\` (score: ${hotspot.score}, complexity: ${hotspot.complexity}, inbound: ${hotspot.inbound}, outbound: ${hotspot.outbound})`
    );
  return renderBulletList(lines, emptyState);
}

function renderHttpRoutes(
  routeInventory: DocumentationInputModel["sections"]["api_reference"]["body"]["routeInventory"],
  emptyState: string,
  limit = 24
) {
  const lines = routeInventory.httpRoutes
    .slice(0, limit)
    .map(
      (route) => `- \`${route.method.toUpperCase()} ${route.path}\` from \`${route.sourcePath}\``
    );
  if (lines.length === 0) return emptyState;
  return lines.join("\n");
}

function renderUnknowns(items: string[], emptyState: string, limit = 6) {
  return renderBulletList(items, emptyState, limit);
}

function buildFallbackNotice(docName: string) {
  return `> Fallback ${docName} generated from canonical analysis sections because the writer model was unavailable or returned no usable content.`;
}

function getApiReferenceMode(apiReference: DocumentationInputModel["sections"]["api_reference"]) {
  const hasConcreteRuntimeApi = apiReference.body.sourceOfTruth !== "unknown";
  const hasPublicLibrarySurface = apiReference.body.publicSurfacePaths.length > 0;

  if (hasConcreteRuntimeApi) return "runtime";
  if (hasPublicLibrarySurface) return "public-surface";
  return "unknown";
}

export function buildFallbackReadme(repo: Repo, documentationInput: DocumentationInputModel) {
  const { api_reference, architecture, onboarding, overview, risks } = documentationInput.sections;
  const primaryEntrypoints = overview.body.primaryEntrypoints;
  const apiReferenceMode = getApiReferenceMode(api_reference);

  return [
    `# ${repo.name}`,
    buildFallbackNotice("README"),
    "## What This Repository Is",
    renderSectionSummary(overview, "Repository purpose is only partially known."),
    "## Stack and Shape",
    renderBulletList(
      [
        `Repository kind: ${overview.body.repositoryKind}.`,
        ...(overview.body.stackProfile.length > 0
          ? [`Stack profile: ${overview.body.stackProfile.join(", ")}.`]
          : []),
        ...(documentationInput.codebase.frameworkFacts.length > 0
          ? [
              `Detected framework/runtime profile: ${documentationInput.codebase.frameworkFacts
                .slice(0, 8)
                .map((fact) => fact.name)
                .join(", ")}.`,
            ]
          : []),
      ],
      "Stack details are only partially known."
    ),
    "## Primary Entrypoints",
    renderBulletList(
      primaryEntrypoints.map((path) => `\`${path}\``),
      "Primary entrypoints are not confidently known.",
      12
    ),
    "## Architecture Snapshot",
    renderModules(architecture.body.modules, "Core modules were not identified confidently."),
    "## Public Interface",
    apiReferenceMode !== "runtime"
      ? renderBulletList(
          [
            apiReferenceMode === "public-surface"
              ? "This repository exposes a framework/library public surface rather than a concrete application HTTP API."
              : "Concrete runtime API evidence is weak, so the public interface is only partially known.",
            ...(api_reference.body.publicSurfacePaths.length > 0
              ? [
                  `Primary public surface files: ${api_reference.body.publicSurfacePaths
                    .slice(0, 12)
                    .map((path) => `\`${path}\``)
                    .join(", ")}.`,
                ]
              : []),
          ],
          "Public interface surface is only partially known."
        )
      : renderBulletList(
          [
            `API source of truth: ${api_reference.body.sourceOfTruth}.`,
            `Estimated operations: ${api_reference.body.routeInventory.estimatedOperations}.`,
            ...(api_reference.body.routeInventory.sourceFiles.length > 0
              ? [
                  `Route/source files: ${api_reference.body.routeInventory.sourceFiles
                    .slice(0, 12)
                    .map((path) => `\`${path}\``)
                    .join(", ")}.`,
                ]
              : []),
          ],
          "Public API surface is only partially known."
        ),
    "## Risks and Caveats",
    renderBulletList(
      [
        ...risks.body.findings.slice(0, 6).map((finding) => `${finding.title}: ${finding.summary}`),
        ...risks.unknowns,
      ],
      "No major risk cluster was auto-detected."
    ),
    "## Getting Started",
    renderBulletList(
      onboarding.body.newcomerSteps,
      "No newcomer steps were derived confidently.",
      10
    ),
    "## First Look Paths",
    renderBulletList(
      onboarding.body.firstLookPaths.map((path) => `\`${path}\``),
      "No first-look paths were suggested.",
      12
    ),
  ].join("\n\n");
}

export function buildFallbackArchitecture(repo: Repo, documentationInput: DocumentationInputModel) {
  const { api_reference, architecture, onboarding, overview, risks } = documentationInput.sections;
  const graph = architecture.body.graphReliability;
  const apiReferenceMode = getApiReferenceMode(api_reference);

  return [
    `# ${repo.name} Architecture`,
    buildFallbackNotice("ARCHITECTURE document"),
    "## System Shape",
    renderSectionSummary(architecture, "Architecture shape is only partially known."),
    "## Core Runtime Modules",
    renderModules(architecture.body.modules, "Core modules were not identified confidently."),
    "## Entrypoints",
    renderBulletList(
      architecture.body.primaryEntrypoints.map((path) => `\`${path}\``),
      "Primary entrypoints are only partially known.",
      12
    ),
    "## Dependency Graph",
    renderBulletList(
      [
        `Resolved internal edges: ${graph.resolvedEdges}.`,
        `Unresolved internal imports: ${graph.unresolvedImportSpecifiers}.`,
        ...(architecture.body.dependencyCycles.length > 0
          ? [`Dependency cycle groups: ${architecture.body.dependencyCycles.length}.`]
          : ["No dependency cycles were detected in analyzed files."]),
        ...(architecture.body.orphanModules.length > 0
          ? [
              `Orphan runtime-relevant modules: ${architecture.body.orphanModules.slice(0, 8).join(", ")}.`,
            ]
          : []),
      ],
      "Dependency graph reliability is unknown."
    ),
    "## Public Surface",
    apiReferenceMode !== "runtime"
      ? renderBulletList(
          [
            apiReferenceMode === "public-surface"
              ? "This repository behaves more like a framework/library public surface than a concrete application API."
              : "Concrete runtime API evidence is weak, so the public surface stays only partially known.",
            ...(api_reference.body.publicSurfacePaths.length > 0
              ? [
                  `Representative public files: ${api_reference.body.publicSurfacePaths
                    .slice(0, 12)
                    .map((path) => `\`${path}\``)
                    .join(", ")}.`,
                ]
              : []),
          ],
          "Public surface is only partially known."
        )
      : renderBulletList(
          [
            `API source of truth: ${api_reference.body.sourceOfTruth}.`,
            `Estimated operations: ${api_reference.body.routeInventory.estimatedOperations}.`,
          ],
          "API surface is only partially known."
        ),
    "## Risks and Hotspots",
    renderBulletList(
      [
        ...risks.body.findings.slice(0, 8).map((finding) => `${finding.title}: ${finding.summary}`),
        ...risks.body.hotspots
          .slice(0, 6)
          .map((hotspot) => `Hotspot \`${hotspot.path}\` with score ${hotspot.score}.`),
      ],
      "No strong risk cluster was auto-detected."
    ),
    "## Onboarding Anchors",
    renderBulletList(
      onboarding.body.firstLookPaths.map((path) => `\`${path}\``),
      "No onboarding anchors were identified.",
      12
    ),
    "## Known Unknowns",
    renderUnknowns(
      [
        ...overview.unknowns,
        ...architecture.unknowns,
        ...api_reference.unknowns,
        ...risks.unknowns,
      ],
      "No major unknowns were recorded."
    ),
  ].join("\n\n");
}

export function buildFallbackApiDocument(repo: Repo, documentationInput: DocumentationInputModel) {
  const apiReference = documentationInput.sections.api_reference;
  const apiReferenceMode = getApiReferenceMode(apiReference);
  const title =
    apiReferenceMode === "runtime"
      ? "# API Reference"
      : apiReferenceMode === "public-surface"
        ? "# Public Interface Reference"
        : "# API / Public Interface Reference";

  return [
    title,
    buildFallbackNotice("API/reference document"),
    "## Repository Context",
    renderBulletList(
      [
        `Repository: ${repo.owner}/${repo.name}.`,
        `API source of truth: ${apiReference.body.sourceOfTruth}.`,
        ...(apiReference.body.frameworkFacts.length > 0
          ? [
              `Framework/runtime profile: ${apiReference.body.frameworkFacts
                .slice(0, 8)
                .map((fact) => fact.name)
                .join(", ")}.`,
            ]
          : []),
      ],
      "Repository context is only partially known."
    ),
    apiReferenceMode !== "runtime" ? "## Public Interface Surface" : "## Runtime API Surface",
    apiReferenceMode === "public-surface"
      ? renderBulletList(
          [
            "No strong concrete runtime route evidence was found, so this document focuses on public framework/library surface.",
            ...(apiReference.body.entrypoints.length > 0
              ? [
                  `Primary interface entrypoints: ${apiReference.body.entrypoints
                    .slice(0, 12)
                    .map((entrypoint) => `\`${entrypoint.path}\``)
                    .join(", ")}.`,
                ]
              : []),
            ...(apiReference.body.publicSurfacePaths.length > 0
              ? [
                  `Representative public files: ${apiReference.body.publicSurfacePaths
                    .slice(0, 16)
                    .map((path) => `\`${path}\``)
                    .join(", ")}.`,
                ]
              : []),
          ],
          "Public interface surface is only partially known."
        )
      : apiReferenceMode === "unknown"
        ? renderBulletList(
            [
              "Concrete runtime API evidence is weak, and a stable public interface surface was not identified confidently.",
              ...(apiReference.body.entrypoints.length > 0
                ? [
                    `Candidate interface entrypoints: ${apiReference.body.entrypoints
                      .slice(0, 12)
                      .map((entrypoint) => `\`${entrypoint.path}\``)
                      .join(", ")}.`,
                  ]
                : []),
            ],
            "API/public interface surface is only partially known."
          )
        : renderBulletList(
            [
              `Estimated operations: ${apiReference.body.routeInventory.estimatedOperations}.`,
              ...(apiReference.body.routeInventory.rpcProcedures > 0
                ? [`RPC procedures: ${apiReference.body.routeInventory.rpcProcedures}.`]
                : []),
              ...(apiReference.body.routeInventory.sourceFiles.length > 0
                ? [
                    `Route/source files: ${apiReference.body.routeInventory.sourceFiles
                      .slice(0, 16)
                      .map((path) => `\`${path}\``)
                      .join(", ")}.`,
                  ]
                : []),
            ],
            "Runtime API surface is only partially known."
          ),
    "## Routes",
    apiReferenceMode !== "runtime"
      ? renderBulletList(
          apiReference.summary,
          "Concrete HTTP routes were not extracted confidently.",
          6
        )
      : renderHttpRoutes(
          apiReference.body.routeInventory,
          "Concrete HTTP routes were not extracted confidently."
        ),
    "## Caveats",
    renderUnknowns(apiReference.unknowns, "No major API/reference caveats were recorded."),
  ].join("\n\n");
}

export function buildFallbackContributing(docInput: DocumentationInputModel) {
  return [
    "# Contributing",
    buildFallbackNotice("CONTRIBUTING guide"),
    "## Before You Change Anything",
    renderBulletList(
      docInput.sections.onboarding.body.newcomerSteps,
      "No guided setup steps were derived confidently.",
      10
    ),
    "## First Files to Read",
    renderBulletList(
      docInput.sections.onboarding.body.firstLookPaths.map((path) => `\`${path}\``),
      "No first-look files were suggested.",
      12
    ),
    "## Architecture Notes",
    renderSectionSummary(
      docInput.sections.architecture,
      "Architecture notes are only partially known.",
      6
    ),
    "## Risks to Review",
    renderHotspots(docInput.risks.hotspots, "No major hotspots were identified confidently."),
  ].join("\n\n");
}
