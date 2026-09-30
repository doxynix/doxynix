import { appLogger } from "@/server/core/app-logger";

type SafetyLevel = "moderate" | "permissive" | "strict";
type DataHandlingStrategy = "escape-json" | "escape-xml" | "no-escape" | "sanitize-html";

export class SafetyContext {
  private level: SafetyLevel = "strict";
  private strategies: Map<string, DataHandlingStrategy> = new Map();

  constructor(level: SafetyLevel = "strict") {
    this.level = level;
    this.setupDefaultStrategies();
  }

  createEvidenceBlock(
    tag: string,
    data: object,
    {
      allowedPaths,
      maxSize = 100_000,
      validatePaths = false,
    }: { allowedPaths?: Set<string>; maxSize?: number; validatePaths?: boolean } = {},
  ): { invalidPaths: string[]; truncated: boolean; xml: string } {
    const json = JSON.stringify(data, null, 2);
    let truncated = false;
    let content = json;
    let invalidPaths: string[] = [];

    if (content.length > maxSize) {
      content = `${content.slice(0, maxSize)}\n// [DATA TRUNCATED]`;
      truncated = true;
    }

    if (validatePaths && "paths" in data && Array.isArray(data.paths)) {
      const pathsData = (data as { paths: string[] }).paths;
      const validation = this.validatePaths(pathsData, allowedPaths);
      invalidPaths = validation.invalid;
    }

    const safeContent = content.includes("]]>") ? content.replaceAll("]]>", "]]&gt;") : content;

    return {
      invalidPaths,
      truncated,
      xml: `<${tag}>\n<![CDATA[\n${safeContent}\n]]>\n</${tag}>`,
    };
  }

  escape(data: string, context: "json" | "xml-attr" | "xml-text" = "xml-text"): string {
    if (this.level === "permissive") {
      return data;
    }

    switch (context) {
      case "xml-text": {
        return data.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
      }
      case "xml-attr": {
        return data.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;");
      }
      case "json": {
        return JSON.stringify(data);
      }
      default: {
        return data;
      }
    }
  }

  generateSafetyReport(data: {
    maxDataSize?: number;
    pathsValidated?: number;
    userInputPresent?: boolean;
    xmlTags?: number;
  }): string {
    const report: string[] = [];
    if (data.xmlTags != null) {
      report.push(`✓ XML tags properly escaped: ${data.xmlTags}`);
    }
    if (data.maxDataSize != null) {
      report.push(`✓ Max data size enforced: ${data.maxDataSize} bytes`);
    }
    if (data.userInputPresent === true) {
      report.push(`⚠ User input present (sanitized)`);
    }
    if (data.pathsValidated != null) {
      report.push(`✓ Paths validated: ${data.pathsValidated}`);
    }
    return report.join("\n");
  }

  prepareAllowedPaths(paths: string[]): string {
    const safe = paths.map((p) => this.escape(p, "xml-text"));
    return safe.join("\n");
  }

  prepareFileContent(
    filePath: string,
    content: string,
    maxLength = 50_000,
    escapeContext: "xml-attr" | "xml-text" = "xml-text",
  ): { content: string; path: string; truncated: boolean } {
    let truncated = false;
    let processedContent = content;

    if (content.length > maxLength) {
      processedContent = `${content.slice(0, maxLength)}\n// [CONTENT TRUNCATED]`;
      truncated = true;
    }

    return {
      content: this.escape(processedContent, escapeContext),
      path: this.escape(filePath, "xml-attr"),
      truncated,
    };
  }
  prepareJsonForPrompt(data: object, escape = true): string {
    const json = JSON.stringify(data, null, 2);
    return escape ? this.escape(json, "xml-text") : json;
  }

  registerStrategy(dataType: string, strategy: DataHandlingStrategy): this {
    this.strategies.set(dataType, strategy);
    return this;
  }

  sanitizeUserInput(input: string): string {
    if (this.level === "strict") {
      const dangerous = [
        /prompt\s*injection/i,
        /system\s*prompt/i,
        /ignore.*instructions/i,
        /bypass/i,
        /jailbreak/i,
      ];

      for (const pattern of dangerous) {
        if (pattern.test(input)) {
          appLogger.warn({
            msg: "Potentially dangerous input pattern detected",
            pattern: pattern.toString(),
          });
          throw new Error("Input contains potentially dangerous patterns");
        }
      }
    }

    return this.escape(input, "xml-text");
  }

  setSafetyLevel(level: SafetyLevel): this {
    this.level = level;
    return this;
  }

  validatePaths(
    paths: string[],
    allowedPaths?: Set<string>,
  ): { invalid: string[]; valid: string[] } {
    if (!allowedPaths || allowedPaths.size === 0) {
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

  private setupDefaultStrategies(): void {
    this.strategies.set("xml", "escape-xml");
    this.strategies.set("json", "escape-json");
    this.strategies.set("html", "sanitize-html");
    this.strategies.set("code", "no-escape");
  }
}

let globalSafetyContext: null | SafetyContext = null;

export function getGlobalSafetyContext(level: SafetyLevel = "strict"): SafetyContext {
  globalSafetyContext ??= new SafetyContext(level);
  return globalSafetyContext;
}

export function resetGlobalSafetyContext(): void {
  globalSafetyContext = null;
}
