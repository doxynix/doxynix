import type { DocType } from "@doxynix/shared";
import { basename } from "pathe";

import { DocumentFormatter } from "./section-graph-linker";

type DependencyGraph = Parameters<typeof DocumentFormatter.withGraphLinks>[1];

const DEFAULT_PER_DOC_LIMIT = 4;
const DEFAULT_TOTAL_LIMIT = 8;

export type DocSectionMatch = {
  docId: string;
  docType: DocType;
  id: string;
  title: string;
};

export type MatchableDoc = {
  content: string;
  id: string;
  type: DocType;
  version: string;
};

export function buildDocSearchTerms(relatedFiles: string[]): string[] {
  return relatedFiles.flatMap((path) => {
    const fileName = basename(path);
    return [fileName.toLowerCase(), path.toLowerCase()];
  });
}

// Capped per document and overall so one huge document cannot flood the inspector
export function matchDocSections(params: {
  docs: MatchableDoc[];
  graph: DependencyGraph;
  nodeId: string;
  nodeLabel: string;
  relatedFiles: string[];
  perDocLimit?: number;
  totalLimit?: number;
}): DocSectionMatch[] {
  const { docs, graph, nodeId, nodeLabel, relatedFiles } = params;
  const perDocLimit = params.perDocLimit ?? DEFAULT_PER_DOC_LIMIT;
  const totalLimit = params.totalLimit ?? DEFAULT_TOTAL_LIMIT;

  const fileTerms = buildDocSearchTerms(relatedFiles);
  const searchLabel = nodeLabel.toLowerCase();

  return docs
    .flatMap((doc) => {
      const formatted = DocumentFormatter.withGraphLinks(doc.content, graph, doc.type, doc.version);

      return formatted.sections
        .filter((section) => {
          const lowerTitle = section.title.toLowerCase();
          const lowerContent = section.content.toLowerCase();

          return (
            section.graphNodeIds.includes(nodeId) ||
            lowerTitle.includes(searchLabel) ||
            fileTerms.some((term) => lowerTitle.includes(term) || lowerContent.includes(term))
          );
        })
        .slice(0, perDocLimit)
        .map((section) => ({
          docId: doc.id,
          docType: doc.type,
          id: section.id,
          title: section.title,
        }));
    })
    .slice(0, totalLimit);
}
