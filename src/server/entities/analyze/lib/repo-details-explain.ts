type ExplainNodeLike = {
  kind: string;
  label: string;
  markers: {
    api: boolean;
    config: boolean;
    entrypoint: boolean;
    risk: boolean;
    server: boolean;
    shared: boolean;
  };
  nodeType: "file" | "group";
  stats: {
    apiCount: number;
    entrypointCount: number;
  };
};

function unique<T>(values: T[]) {
  return Array.from(new Set(values));
}

export function buildNodeRole(node: ExplainNodeLike, semanticLabel: string) {
  if (node.nodeType === "file") {
    if (node.markers.entrypoint) return "File with localized entrypoint significance";
    if (node.markers.api) return "File participating in the public API surface";
    if (node.markers.config) return "Configuration-heavy file";
    if (node.markers.shared) return "Shared support file";
    return "File with localized architectural importance";
  }

  if (node.markers.entrypoint && node.markers.server) return "Backend entry area";
  if (node.markers.api) return "API-facing structural zone";
  if (node.markers.config) return "Configuration-heavy area";
  if (node.markers.shared) return "Shared support module";

  return `${semanticLabel} structural area`;
}

export function buildNodeExplainSummary(params: {
  changeCouplingCount: number;
  churnCount: number;
  dependencyHotspotCount: number;
  findingsCount: number;
  frameworkCount: number;
  graphWarningCount: number;
  hotspotCount: number;
  node: ExplainNodeLike;
  orphanCount: number;
  relatedFactCount: number;
  role: string;
  scopedPathCount: number;
}) {
  const lines: string[] = [];

  lines.push(`${params.node.label} acts as a ${params.role.toLowerCase()}.`);

  if (params.node.markers.entrypoint) {
    lines.push("This area includes likely entrypoints, so it influences where execution begins.");
  } else if (params.node.markers.api) {
    lines.push("This area touches the public-facing surface of the repository.");
  } else if (params.node.markers.shared) {
    lines.push("This area is reused across multiple parts of the repository.");
  }

  if (params.node.markers.risk || params.findingsCount > 0) {
    lines.push("Risk-related evidence points here, so changes in this area deserve extra review.");
  } else if (params.node.markers.config) {
    lines.push("Configuration and runtime setup signals make this area operationally important.");
  }

  if (params.hotspotCount > 0 || params.dependencyHotspotCount > 0) {
    lines.push(
      "Hotspot and dependency-centrality signals suggest this node can amplify change impact."
    );
  } else if (params.churnCount > 0 || params.changeCouplingCount > 0) {
    lines.push(
      "Recent git history suggests this node changes often or changes alongside nearby files."
    );
  } else if (params.frameworkCount > 0) {
    lines.push("Framework/runtime hints suggest this area anchors important integration behavior.");
  }

  if (params.graphWarningCount > 0 || params.orphanCount > 0) {
    lines.push(
      "Some dependency evidence around this node is partial or isolated, so manual verification may help."
    );
  }

  if (params.scopedPathCount > 1) {
    lines.push(`The current scope covers ${params.scopedPathCount} meaningful paths.`);
  } else if (params.relatedFactCount > 0) {
    lines.push("Repository facts reinforce the structural importance of this node.");
  }

  return unique(lines).slice(0, 4);
}

export function buildExplainConfidence(params: {
  findingsCount: number;
  node: ExplainNodeLike;
  sourcePathCount: number;
}) {
  const strongSignals = [
    params.node.markers.entrypoint,
    params.node.markers.api,
    params.node.markers.risk,
    params.node.stats.apiCount > 0,
    params.node.stats.entrypointCount > 0,
    params.findingsCount > 0,
    params.sourcePathCount >= 3,
  ].filter(Boolean).length;

  if (strongSignals >= 3) return "high" as const;
  if (strongSignals >= 2 || params.node.kind !== "unknown") return "medium" as const;
  return "low" as const;
}
