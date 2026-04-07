import type {
  InteractiveBriefActionAvailability,
  InteractiveBriefNodePayload,
  InteractiveBriefPanel,
  InteractiveBriefPayload,
} from "@/server/shared/types";

function toAvailableActions(params: {
  canDrillDeeper: boolean;
  nodeType: "file" | "group";
}): InteractiveBriefActionAvailability {
  const isFile = params.nodeType === "file";

  return {
    canDocumentFile: isFile,
    canDrillDeeper: params.canDrillDeeper,
    canOpenFileContext: isFile,
    canQuickAudit: isFile,
  };
}

export function buildInteractiveBriefPanel(params: {
  explain: {
    confidence: "high" | "low" | "medium";
    nextSuggestedPaths: string[];
    relationships: InteractiveBriefPanel["explain"]["relationships"];
    role: string;
    sourcePaths: string[];
    summary: string[];
    whyImportant: string;
  };
  structureNode: {
    breadcrumbs: Array<{ id: string; label: string; path: string }>;
    canDrillDeeper: boolean;
    children: InteractiveBriefPanel["node"][];
    edges: InteractiveBriefPayload["structure"]["edges"];
    inspect: InteractiveBriefPanel["inspect"];
    node: InteractiveBriefPanel["node"];
  };
}): InteractiveBriefPanel {
  return {
    availableActions: toAvailableActions({
      canDrillDeeper: params.structureNode.canDrillDeeper,
      nodeType: params.structureNode.node.nodeType,
    }),
    breadcrumbs: params.structureNode.breadcrumbs.map((item) => ({
      id: item.id,
      label: item.label,
      path: item.path,
    })),
    drilldownPreview: {
      childCount: params.structureNode.children.length,
      childLabels: params.structureNode.children.map((child) => child.label).slice(0, 8),
      edgeCount: params.structureNode.edges.length,
    },
    explain: {
      confidence: params.explain.confidence,
      nextSuggestedPaths: params.explain.nextSuggestedPaths,
      relationships: params.explain.relationships,
      role: params.explain.role,
      sourcePaths: params.explain.sourcePaths,
      summary: params.explain.summary,
      whyImportant: params.explain.whyImportant,
    },
    inspect: params.structureNode.inspect,
    node: params.structureNode.node,
  };
}

export function buildInteractiveBriefPayload(params: {
  analysisRef: InteractiveBriefPayload["analysisRef"];
  capabilities: InteractiveBriefPayload["capabilities"];
  defaultNodeId: string | null;
  docsSummary: InteractiveBriefPayload["docsSummary"];
  overview: InteractiveBriefPayload["overview"];
  panel: InteractiveBriefPanel | null;
  structure: InteractiveBriefPayload["structure"];
}) {
  return {
    analysisRef: params.analysisRef,
    capabilities: params.capabilities,
    docsSummary: params.docsSummary,
    overview: params.overview,
    panel: {
      defaultNode: params.panel,
    },
    selection: {
      defaultNodeId: params.defaultNodeId,
    },
    structure: {
      edges: params.structure.edges,
      groups: params.structure.groups,
      nodes: params.structure.nodes,
    },
  } satisfies InteractiveBriefPayload;
}

export function buildInteractiveBriefNodePayload(params: {
  explain: {
    analysisRef: InteractiveBriefNodePayload["analysisRef"];
    confidence: "high" | "low" | "medium";
    nextSuggestedPaths: string[];
    relationships: InteractiveBriefPanel["explain"]["relationships"];
    role: string;
    sourcePaths: string[];
    summary: string[];
    whyImportant: string;
  };
  structureNode: {
    analysisRef: InteractiveBriefNodePayload["analysisRef"];
    breadcrumbs: Array<{ id: string; label: string; path: string }>;
    canDrillDeeper: boolean;
    children: InteractiveBriefPanel["node"][];
    edges: InteractiveBriefPayload["structure"]["edges"];
    inspect: InteractiveBriefPanel["inspect"];
    node: InteractiveBriefPanel["node"];
  };
}) {
  const panel = buildInteractiveBriefPanel({
    explain: {
      confidence: params.explain.confidence,
      nextSuggestedPaths: params.explain.nextSuggestedPaths,
      relationships: params.explain.relationships,
      role: params.explain.role,
      sourcePaths: params.explain.sourcePaths,
      summary: params.explain.summary,
      whyImportant: params.explain.whyImportant,
    },
    structureNode: {
      breadcrumbs: params.structureNode.breadcrumbs,
      canDrillDeeper: params.structureNode.canDrillDeeper,
      children: params.structureNode.children,
      edges: params.structureNode.edges,
      inspect: params.structureNode.inspect,
      node: params.structureNode.node,
    },
  });

  return {
    analysisRef: params.structureNode.analysisRef ?? params.explain.analysisRef,
    availableActions: panel.availableActions,
    breadcrumbs: panel.breadcrumbs,
    canDrillDeeper: params.structureNode.canDrillDeeper,
    children: params.structureNode.children,
    edges: params.structureNode.edges,
    explain: panel.explain,
    inspect: panel.inspect,
    node: panel.node,
  } satisfies InteractiveBriefNodePayload;
}
