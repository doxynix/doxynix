type DocumentSection = {
  content: string;
  endLine?: number;
  graphNodeIds: string[];
  id: string;
  startLine?: number;
  title: string;
};

type DocumentWithSections = {
  sections: DocumentSection[];
  type: string;
  version: string;
};

type GraphNode = {
  id: string;
  label?: string;
  name?: string;
};

type DependencyGraph = {
  nodes: GraphNode[];
};

const HEADING_REGEX = /^#+\s+/;
const SPACES_REGEX = /\s+/g;
const WORD_SPLIT_REGEX = /[\s-_]+/;

const MENTION_PATTERNS = [
  /(?:component|module|service|class)\s+(?:named\s+)?["']?(\w+)["']?/gi,
  /(?:file|path)\s+["']?([^\s"'>]+)["']?/gi,
  /###\s+(?:component|module):\s+(\w+)/gi,
];

/**
 * Links documentation sections to dependency graph nodes
 * Enables UI synergy: click graph node -> highlight doc section
 */
class DocumentGraphLinker {
  /**
   * Extract anchors and link to graph nodes
   */
  public static linkSectionsToGraph(
    document: string,
    dependencyGraph: DependencyGraph | null | undefined,
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
      if (HEADING_REGEX.test(line)) {
        // Save previous section
        if (currentSection) {
          currentSection.content = contentBuffer.join("\n").trim();
          currentSection.endLine = i - 1;
          sections.push(currentSection as DocumentSection);
        } else if (contentBuffer.join("").trim().length > 0) {
          sections.push({
            content: contentBuffer.join("\n").trim(),
            endLine: i - 1,
            graphNodeIds: [],
            id: this.generateSectionId(docType, "preamble"),
            startLine: 0,
            title: "Preamble",
          });
        }

        // Start new section
        const title = line.replace(HEADING_REGEX, "").trim();

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

  /**
   * Find graph nodes related to doc section
   * Uses heuristics: component name mentions, file references, etc.
   */
  private static findRelatedGraphNodes(
    section: DocumentSection,
    graph: DependencyGraph | null | undefined
  ): string[] {
    const nodeIds: string[] = [];
    const content = section.content.toLowerCase();
    const sectionTitleLower = section.title.toLowerCase();

    // Extract potential node names from content
    const mentionedNames = new Set<string>();

    for (const pattern of MENTION_PATTERNS) {
      pattern.lastIndex = 0;
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
        const nodeId = node.id;

        if (mentionedNames.has(nodeName) || this.isSimilar(nodeName, sectionTitleLower)) {
          nodeIds.push(nodeId);
        }
      }
    }

    return nodeIds;
  }

  private static generateSectionId(docType: string, title: string): string {
    return `section-${docType.toLowerCase()}-${title.toLowerCase().replaceAll(SPACES_REGEX, "-")}`;
  }

  private static isSimilar(str1: string, str2: string): boolean {
    // Simple similarity: contains or shared meaningful words
    const words1 = str1.split(WORD_SPLIT_REGEX).filter((w) => w.length > 1);
    const words2 = str2.split(WORD_SPLIT_REGEX).filter((w) => w.length > 1);

    if (words1.length === 0 || words2.length === 0) return false;

    const set2 = new Set(words2);
    for (const word1 of words1) {
      if (set2.has(word1)) return true;
      for (const word2 of words2) {
        if (word1.includes(word2) || word2.includes(word1)) {
          return true;
        }
      }
    }

    return false;
  }
}

/**
 * Formats document with graph links for API response
 */
export class DocumentFormatter {
  public static withGraphLinks(
    document: string,
    graph: DependencyGraph | null | undefined,
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
