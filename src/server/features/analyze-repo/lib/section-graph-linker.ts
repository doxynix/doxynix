export interface DocumentSection {
  content: string;
  endLine?: number;
  graphNodeIds: string[];
  id: string;
  startLine?: number;
  title: string;
}

export interface DocumentWithSections {
  sections: DocumentSection[];
  type: string;
  version: string;
}

/**
 * Links documentation sections to dependency graph nodes
 * Enables UI synergy: click graph node -> highlight doc section
 */
export class DocumentGraphLinker {
  /**
   * Extract anchors and link to graph nodes
   */
  static linkSectionsToGraph(
    document: string,
    dependencyGraph: any, // Graph structure from analyzer
    docType: string
  ): DocumentSection[] {
    const sections: DocumentSection[] = [];

    // Split document into sections (by headings)
    const lines = document.split("\n");
    let currentSection: null | Partial<DocumentSection> = null;
    let contentBuffer: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;

      // Detect heading (markdown # style)
      if (RegExp(/^#+\s+/).exec(line)) {
        // Save previous section
        if (currentSection) {
          currentSection.content = contentBuffer.join("\n").trim();
          currentSection.endLine = i - 1;
          sections.push(currentSection as DocumentSection);
        }

        // Start new section
        const title = line.replace(/^#+\s+/, "").trim();

        currentSection = {
          graphNodeIds: [],
          id: this.generateSectionId(docType, title),
          startLine: i,
          title,
        };

        contentBuffer = [];
      } else {
        contentBuffer.push(line);
      }
    }

    // Save last section
    if (currentSection) {
      currentSection.content = contentBuffer.join("\n").trim();
      currentSection.endLine = lines.length - 1;
      sections.push(currentSection as DocumentSection);
    } else if (document.trim().length > 0) {
      // Fallback: create single section if no headings found
      sections.push({
        content: document.trim(),
        endLine: lines.length - 1,
        graphNodeIds: [],
        id: this.generateSectionId(docType, "document"),
        startLine: 0,
        title: "Document",
      });
    }

    // Link sections to graph nodes
    return sections.map((section) => ({
      ...section,
      graphNodeIds: this.findRelatedGraphNodes(section as DocumentSection, dependencyGraph),
    }));
  }

  private static generateSectionId(docType: string, title: string): string {
    return `section-${docType.toLowerCase()}-${title.toLowerCase().replaceAll(/\s+/g, "-")}`;
  }

  /**
   * Find graph nodes related to doc section
   * Uses heuristics: component name mentions, file references, etc.
   */
  private static findRelatedGraphNodes(section: DocumentSection, graph: any): string[] {
    const nodeIds: string[] = [];
    const content = section.content.toLowerCase();

    // Extract potential node names from content
    const patterns = [
      /(?:component|module|service|class)\s+(?:named\s+)?"?(\w+)"?/gi,
      /(?:file|path)\s+"?([^\n"]+)"?/gi,
      /###\s+(?:component|module):\s+(\w+)/gi,
    ];

    const mentionedNames = new Set<string>();
    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        if (match[1] != null) {
          mentionedNames.add(match[1].toLowerCase());
        }
      }
    }

    // Match against graph nodes
    if (graph?.nodes != null && Array.isArray(graph.nodes)) {
      for (const node of graph.nodes) {
        const nodeName = (node.label ?? node.name ?? "").toLowerCase();
        const nodeId = node.id ?? "";

        if (mentionedNames.has(nodeName) || this.isSimilar(nodeName, section.title.toLowerCase())) {
          nodeIds.push(nodeId);
        }
      }
    }

    return nodeIds;
  }

  private static isSimilar(str1: string, str2: string): boolean {
    // Simple similarity: contains or shared meaningful words
    const words1 = str1.split(/[\s-_]+/);
    const words2 = str2.split(/[\s-_]+/);

    const shared = words1.filter((w) => words2.some((w2) => w2.includes(w) || w.includes(w2)));
    return shared.length > 0;
  }
}

/**
 * Formats document with graph links for API response
 */
export class DocumentFormatter {
  static withGraphLinks(
    document: string,
    graph: any,
    docType: string,
    version: string
  ): DocumentWithSections {
    const sections = DocumentGraphLinker.linkSectionsToGraph(document, graph, docType);

    return {
      sections,
      type: docType,
      version,
    };
  }
}
