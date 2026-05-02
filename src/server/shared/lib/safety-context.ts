/**
 * SafetyContext
 * Unified safety settings and data handling rules for LLM interactions.
 * Centralizes escaping, sanitization, and validation logic.
 */

import { logger } from "../infrastructure/logger";
import { escapePromptXmlAttr, escapePromptXmlText } from "./string-utils";

/**
 * Safety level for handling user input
 */
type SafetyLevel = "moderate" | "permissive" | "strict";

/**
 * Data handling strategy
 */
type DataHandlingStrategy = "escape-json" | "escape-xml" | "no-escape" | "sanitize-html";

/**
 * SafetyContext manages all data safety and escaping across LLM prompts
 */
export class SafetyContext {
  private level: SafetyLevel = "strict";
  private strategies: Map<string, DataHandlingStrategy> = new Map();

  constructor(level: SafetyLevel = "strict") {
    this.level = level;
    this.setupDefaultStrategies();
  }

  /**
   * Setup default escaping strategies per data type
   */
  private setupDefaultStrategies(): void {
    this.strategies.set("xml", "escape-xml");
    this.strategies.set("json", "escape-json");
    this.strategies.set("html", "sanitize-html");
    this.strategies.set("code", "no-escape");
  }

  /**
   * Set safety level
   */
  setSafetyLevel(level: SafetyLevel): this {
    this.level = level;
    return this;
  }

  /**
   * Register custom handling strategy for a data type
   */
  registerStrategy(dataType: string, strategy: DataHandlingStrategy): this {
    this.strategies.set(dataType, strategy);
    return this;
  }

  /**
   * Escape data based on context type
   */
  escape(data: string, context: "json" | "xml-attr" | "xml-text" = "xml-text"): string {
    if (this.level === "permissive") {
      return data;
    }

    switch (context) {
      case "xml-text": {
        return escapePromptXmlText(data);
      }
      case "xml-attr": {
        return escapePromptXmlAttr(data);
      }
      case "json": {
        return JSON.stringify(data);
      }
      default: {
        return data;
      }
    }
  }

  /**
   * Sanitize user input that will be embedded in prompts
   */
  sanitizeUserInput(input: string): string {
    if (this.level === "strict") {
      // Remove or reject potentially dangerous patterns
      const dangerous = [
        /prompt\s*injection/i,
        /system\s*prompt/i,
        /ignore.*instructions/i,
        /bypass/i,
        /jailbreak/i,
      ];

      for (const pattern of dangerous) {
        if (pattern.test(input)) {
          logger.warn({
            msg: "Potentially dangerous input pattern detected",
            pattern: pattern.toString(),
          });
          // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
          if (this.level === "strict") {
            throw new Error("Input contains potentially dangerous patterns");
          }
        }
      }
    }

    return this.escape(input, "xml-text");
  }

  /**
   * Prepare JSON for embedding in prompts
   */
  prepareJsonForPrompt(data: object, escape = true): string {
    const json = JSON.stringify(data, null, 2);
    return escape ? this.escape(json, "xml-text") : json;
  }

  /**
   * Prepare file content for embedding in prompts
   */
  prepareFileContent(
    filePath: string,
    content: string,
    maxLength = 50_000,
    escapeContext: "xml-attr" | "xml-text" = "xml-text"
  ): { content: string; path: string; truncated: boolean } {
    let truncated = false;
    let processedContent = content;

    if (content.length > maxLength) {
      processedContent = content.slice(0, maxLength) + "\n// [CONTENT TRUNCATED]";
      truncated = true;
    }

    return {
      content: this.escape(processedContent, escapeContext),
      path: this.escape(filePath, "xml-attr"),
      truncated,
    };
  }

  /**
   * Validate repository paths
   */
  validatePaths(
    paths: string[],
    allowedPaths?: Set<string>
  ): { invalid: string[]; valid: string[] } {
    if (!allowedPaths || allowedPaths.size === 0) {
      // If no restrictions, all paths are valid
      return { invalid: [], valid: paths };
    }

    const valid: string[] = [];
    const invalid: string[] = [];

    for (const path of paths) {
      if (allowedPaths.has(path)) {
        valid.push(path);
      } else {
        invalid.push(path);
      }
    }

    return { invalid, valid };
  }

  /**
   * Prepare allowed paths list for inclusion in prompts
   */
  prepareAllowedPaths(paths: string[]): string {
    const safe = paths.map((p) => this.escape(p, "xml-text"));
    return safe.join("\n");
  }

  /**
   * Create a safety-checked evidence block
   */
  createEvidenceBlock(
    tag: string,
    data: object,
    {
      allowedPaths,
      maxSize = 100_000,
      validatePaths = false,
    }: { allowedPaths?: Set<string>; maxSize?: number; validatePaths?: boolean } = {}
  ): { invalidPaths: string[]; truncated: boolean; xml: string } {
    const json = JSON.stringify(data, null, 2);
    let truncated = false;
    let content = json;
    let invalidPaths: string[] = [];

    // Check size
    if (content.length > maxSize) {
      content = content.slice(0, maxSize) + "\n// [DATA TRUNCATED]";
      truncated = true;
    }

    // Validate paths if requested
    if (validatePaths && "paths" in data && Array.isArray((data as { paths: unknown }).paths)) {
      const pathsData = (data as { paths: string[] }).paths;
      const validation = this.validatePaths(pathsData, allowedPaths);
      invalidPaths = validation.invalid;
    }

    const escaped = this.escape(content, "xml-text");
    return {
      invalidPaths,
      truncated,
      xml: `<${tag}>\n${escaped}\n</${tag}>`,
    };
  }

  /**
   * Get a safety report for an evidence block
   */
  generateSafetyReport(data: {
    maxDataSize?: number;
    pathsValidated?: number;
    userInputPresent?: boolean;
    xmlTags?: number;
  }): string {
    const report: string[] = [];
    if (data.xmlTags != null) report.push(`✓ XML tags properly escaped: ${data.xmlTags}`);
    if (data.maxDataSize != null)
      report.push(`✓ Max data size enforced: ${data.maxDataSize} bytes`);
    if (data.userInputPresent === true) report.push(`⚠ User input present (sanitized)`);
    if (data.pathsValidated != null) report.push(`✓ Paths validated: ${data.pathsValidated}`);
    return report.join("\n");
  }
}

/**
 * Global safety context singleton
 */
let globalSafetyContext: null | SafetyContext = null;

/**
 * Get or create global safety context
 */
function getGlobalSafetyContext(level: SafetyLevel = "strict"): SafetyContext {
  if (!globalSafetyContext) {
    globalSafetyContext = new SafetyContext(level);
  }
  return globalSafetyContext;
}

/**
 * Reset global safety context (for testing)
 */
function resetGlobalSafetyContext(): void {
  globalSafetyContext = null;
}
