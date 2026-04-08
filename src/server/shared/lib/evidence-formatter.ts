/**
 * EvidenceFormatter
 * Unified XML and JSON formatting for evidence blocks embedded in prompts.
 * Provides consistent transformation and escaping across all evidence types.
 */

import { logger } from "@/server/shared/infrastructure/logger";

import { escapePromptXmlAttr, escapePromptXmlText } from "./string-utils";

/**
 * Evidence block types
 */
export type EvidenceType =
  | "repository"
  | "metrics"
  | "risks"
  | "api"
  | "architecture"
  | "modules"
  | "dependencies"
  | "security"
  | "custom";

/**
 * Formatting options for evidence blocks
 */
export type EvidenceFormattingOptions = {
  /** Custom attributes for XML root tag */
  attributes?: Record<string, string>;

  /** Include metadata comment */
  includeMetadata?: boolean;

  /** Maximum size of evidence block in bytes */
  maxSize?: number;

  /** Whether to pretty-print JSON */
  prettyPrint?: boolean;

  /** Truncation suffix when truncated */
  truncationSuffix?: string;
};

/**
 * Result of formatting evidence
 */
export interface FormattedEvidence {
  /** The formatted XML/JSON block */
  content: string;

  /** Metadata about the formatting */
  metadata: {
    format: "xml" | "json";
    originalSize?: number;
    timestamp: Date;
    type: EvidenceType;
  };

  /** Total size in bytes */
  size: number;

  /** Whether the content was truncated */
  truncated: boolean;
}

/**
 * EvidenceFormatter: Manages consistent evidence presentation in prompts
 */
export class EvidenceFormatter {
  private defaultOptions: EvidenceFormattingOptions = {
    includeMetadata: false,
    maxSize: 100000,
    prettyPrint: true,
    truncationSuffix: "\n<!-- [DATA TRUNCATED] -->",
  };

  /**
   * Set default formatting options
   */
  setDefaults(options: Partial<EvidenceFormattingOptions>): this {
    this.defaultOptions = { ...this.defaultOptions, ...options };
    return this;
  }

  /**
   * Format evidence as XML block
   */
  formatXml(
    tag: EvidenceType | string,
    data: object,
    options: EvidenceFormattingOptions = {}
  ): FormattedEvidence {
    const opts = { ...this.defaultOptions, ...options };

    // Convert object to JSON
    const json = JSON.stringify(data, null, opts.prettyPrint === true ? 2 : 0);
    const originalSize = json.length;

    // Escape XML
    let content = escapePromptXmlText(json);

    // Check size and truncate if needed
    let truncated = false;
    if (opts.maxSize != null && content.length > opts.maxSize) {
      content = content.slice(0, opts.maxSize);
      if (opts.truncationSuffix != null) {
        content += opts.truncationSuffix;
      }
      truncated = true;
    }

    // Build attributes
    let attrs = "";
    if (opts.attributes) {
      attrs =
        " " +
        Object.entries(opts.attributes)
          .map(([k, v]) => `${k}="${escapePromptXmlAttr(v)}"`)
          .join(" ");
    }

    // Add metadata comment if requested
    let metadata = "";
    if (opts.includeMetadata === true) {
      metadata = `<!-- Evidence: ${tag}, Size: ${originalSize} bytes, Truncated: ${truncated} -->\n`;
    }

    const xml = `${metadata}<${tag}${attrs}>\n${content}\n</${tag}>`;

    return {
      content: xml,
      metadata: {
        format: "xml",
        originalSize,
        timestamp: new Date(),
        type: tag as EvidenceType,
      },
      size: xml.length,
      truncated,
    };
  }

  /**
   * Format evidence as JSON block
   */
  formatJson(data: object, options: EvidenceFormattingOptions = {}): FormattedEvidence {
    const opts = { ...this.defaultOptions, ...options };

    // Convert to JSON
    let json = JSON.stringify(data, null, opts.prettyPrint === true ? 2 : 0);
    const originalSize = json.length;

    // Check size and truncate if needed
    let truncated = false;
    if (opts.maxSize != null && json.length > opts.maxSize) {
      json = json.slice(0, opts.maxSize);
      if (opts.truncationSuffix != null && !opts.truncationSuffix.includes("<")) {
        // For JSON, use JSON-compatible truncation
        json = json.replace(/,\s*$/, ""); // Remove trailing comma if any
        json += "\n  // [DATA TRUNCATED]";
      }
      truncated = true;
    }

    return {
      content: json,
      metadata: {
        format: "json",
        originalSize,
        timestamp: new Date(),
        type: "custom",
      },
      size: json.length,
      truncated,
    };
  }

  /**
   * Format multiple evidence blocks as a single XML document
   */
  formatComposite(
    blocks: Array<{ data: object; label?: string; type: EvidenceType }>,
    options: EvidenceFormattingOptions = {}
  ): FormattedEvidence {
    const opts = { ...this.defaultOptions, ...options };

    const xmlBlocks: string[] = [];
    let totalSize = 0;
    let anyTruncated = false;

    for (const block of blocks) {
      const formatted = this.formatXml(block.type, block.data, { ...opts, includeMetadata: true });
      xmlBlocks.push(formatted.content);
      totalSize += formatted.size;
      if (formatted.truncated) {
        anyTruncated = true;
      }
    }

    // Check total size
    let composite = xmlBlocks.join("\n\n");
    let truncated = false;

    if (opts.maxSize != null && composite.length > opts.maxSize) {
      composite = composite.slice(0, opts.maxSize);
      if (opts.truncationSuffix != null) {
        composite += opts.truncationSuffix;
      }
      truncated = true;
    }

    return {
      content: composite,
      metadata: {
        format: "xml",
        originalSize: totalSize,
        timestamp: new Date(),
        type: "custom",
      },
      size: composite.length,
      truncated: truncated || anyTruncated,
    };
  }

  /**
   * Format paths list as evidence
   */
  formatPaths(
    paths: string[],
    format: "xml" | "json" | "text" = "xml",
    options: EvidenceFormattingOptions = {}
  ): FormattedEvidence {
    if (format === "text") {
      const content = paths.map((p) => escapePromptXmlText(p)).join("\n");
      return {
        content,
        metadata: {
          format: "xml",
          timestamp: new Date(),
          type: "custom",
        },
        size: content.length,
        truncated: false,
      };
    }

    if (format === "json") {
      return this.formatJson({ paths }, options);
    }

    return this.formatXml("paths", { items: paths }, options);
  }

  /**
   * Format metrics as evidence block
   */
  formatMetrics(metrics: object, options: EvidenceFormattingOptions = {}): FormattedEvidence {
    return this.formatXml("metrics", metrics, { ...options, includeMetadata: true });
  }

  /**
   * Format repository evidence
   */
  formatRepositoryEvidence(
    evidence: object,
    options: EvidenceFormattingOptions = {}
  ): FormattedEvidence {
    return this.formatXml("repository_evidence", evidence, {
      ...options,
      attributes: { type: "structal-analysis" },
      includeMetadata: true,
    });
  }

  /**
   * Create evidence block with validation
   */
  createCheckedBlock(
    type: EvidenceType,
    data: object,
    validator?: (data: object) => boolean | string,
    options: EvidenceFormattingOptions = {}
  ): FormattedEvidence {
    // Run validator if provided
    if (validator) {
      const result = validator(data);
      if (result === false) {
        throw new Error(`Evidence validation failed for type "${type}"`);
      }
      if (typeof result === "string") {
        logger.warn({
          msg: "Evidence validation warning",
          type,
          warning: result,
        });
      }
    }

    return this.formatXml(type, data, options);
  }

  /**
   * Get formatting stats/report
   */
  getFormattingReport(evidence: FormattedEvidence): string {
    const report = [
      `Evidence Type: ${evidence.metadata.type}`,
      `Format: ${evidence.metadata.format}`,
      `Size: ${evidence.size} bytes`,
      `Truncated: ${evidence.truncated}`,
      evidence.metadata.originalSize != null
        ? `Original Size: ${evidence.metadata.originalSize} bytes`
        : null,
      `Timestamp: ${evidence.metadata.timestamp.toISOString()}`,
    ];

    return report.filter(Boolean).join("\n");
  }
}

/**
 * Global evidence formatter singleton
 */
let globalFormatter: EvidenceFormatter | null = null;

/**
 * Get or create global evidence formatter
 */
export function getGlobalEvidenceFormatter(): EvidenceFormatter {
  if (!globalFormatter) {
    globalFormatter = new EvidenceFormatter();
  }
  return globalFormatter;
}

/**
 * Reset global formatter (for testing)
 */
export function resetGlobalEvidenceFormatter(): void {
  globalFormatter = null;
}
