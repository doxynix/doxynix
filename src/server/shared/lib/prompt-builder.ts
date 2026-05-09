/**
 * PromptBuilder
 * Fluent API for constructing system and user prompts with consistent structure.
 */

import { LanguageRules } from "./prompt-rules";
import { escapePromptXmlAttr, escapePromptXmlText } from "./string-utils";

type PromptRole =
  | "api-documentarian"
  | "architect"
  | "architecture-writer"
  | "changelog-writer"
  | "code-analyzer"
  | "code-documenter"
  | "code-reviewer"
  | "contributing-writer"
  | "generic"
  | "readme-writer"
  | "security-sentinel";

/**
 * FluentPromptBuilder for consistent prompt construction
 * Supports method chaining for readability
 */
class PromptBuilder {
  private sections: Map<string, string> = new Map();
  private role: PromptRole = "generic";
  private language: string = "English";

  constructor(role: PromptRole = "generic") {
    this.role = role;
  }

  /**
   * Set the target language for output
   */
  setLanguage(lang: string): this {
    this.language = lang;
    return this;
  }

  /**
   * Add role/persona section
   */
  withRole(description: string): this {
    this.sections.set("role", `# ROLE\n${description}`);
    return this;
  }

  /**
   * Add constraints/rules section
   */
  withConstraints(...rules: (string | undefined)[]): this {
    const filtered = rules.filter(Boolean);
    if (filtered.length > 0) {
      const content = filtered.map((r, i) => `${i + 1}. ${r}`).join("\n");
      this.sections.set("constraints", `# CONSTRAINTS\n${content}`);
    }
    return this;
  }

  /**
   * Add grounding rules section
   */
  withGrounding(...rules: (string | undefined)[]): this {
    const filtered = rules.filter(Boolean);
    if (filtered.length > 0) {
      const content = filtered.map((r) => `- ${r}`).join("\n");
      this.sections.set("grounding", `# GROUNDING\n${content}`);
    }
    return this;
  }

  /**
   * Add task description section
   */
  withTask(description: string): this {
    this.sections.set("task", `# TASK\n${description}`);
    return this;
  }

  /**
   * Add strategy/thinking protocol section
   */
  withStrategy(...steps: (string | undefined)[]): this {
    const filtered = steps.filter(Boolean);
    if (filtered.length > 0) {
      const content = filtered.map((s, i) => `${i + 1}. ${s}`).join("\n");
      this.sections.set("strategy", `# STRATEGY\n${content}`);
    }
    return this;
  }

  /**
   * Add output format section
   */
  withOutputFormat(format: string | { content: string; title: string }): this {
    if (typeof format === "string") {
      this.sections.set("output", `# OUTPUT\n${format}`);
    } else {
      this.sections.set("output", `# ${format.title}\n${format.content}`);
    }
    return this;
  }

  /**
   * Add JSON schema output specification
   */
  withJsonSchema(schema: Record<string, unknown>): this {
    this.sections.set(
      "output",
      `# OUTPUT_SCHEMA\nReturn ONLY a valid JSON object matching this structure. Fill arrays exhaustively:\n\`\`\`json\n${JSON.stringify(schema, null, 2)}\n\`\`\``
    );
    return this;
  }

  /**
   * Add custom section
   */
  addSection(title: string, content: string): this {
    this.sections.set(title.toLowerCase(), `# ${title.toUpperCase()}\n${content}`);
    return this;
  }

  /**
   * Forces the AI to write dense, highly technical text without filler words.
   */
  withAntiFluff(): this {
    this.sections.set(
      "anti_fluff",
      `# QUALITY STANDARDS\n${LanguageRules.antiFluff}\n\n${LanguageRules.exhaustiveDetail}`
    );
    return this;
  }

  /**
   * Set language awareness in output
   */
  withLanguageNotice(): this {
    if (this.language && this.language.toLowerCase() !== "english") {
      this.sections.set(
        "language",
        `# LANGUAGE CONFIGURATION\nOutput ALL markdown, texts, documentation, and technical notes strictly in **${this.language}**.`
      );
    }
    return this;
  }

  /**
   * Build the final system prompt
   */
  buildSystem(): string {
    const sections: string[] = [];

    // Order matters: role → task → constraints → grounding → strategy → quality → language → output
    const order = [
      "role",
      "task",
      "constraints",
      "grounding",
      "strategy",
      "anti_fluff",
      "language",
      "output",
    ];

    for (const key of order) {
      const section = this.sections.get(key);
      if (section != null) {
        sections.push(section);
      }
    }

    // Add any custom sections not in the standard order
    for (const [key, section] of this.sections.entries()) {
      if (!order.includes(key)) {
        sections.push(section);
      }
    }

    return sections.join("\n\n");
  }

  /**
   * Build individual sections (useful for debugging or testing)
   */
  getSections(): Map<string, string> {
    return new Map(this.sections);
  }

  /**
   * Clear all sections
   */
  reset(): this {
    this.sections.clear();
    return this;
  }
}

/**
 * UserPromptBuilder for constructing user prompts with structured data
 * Handles XML wrapping, escaping, and multi-part inputs
 */
export class UserPromptBuilder {
  private parts: Array<{ content: string; escape: boolean; tag?: string }> = [];

  /**
   * Add raw text (no escaping, no wrapping)
   */
  addRaw(text: string): this {
    this.parts.push({ content: text, escape: false });
    return this;
  }

  /**
   * Add XML-wrapped content (auto-escaped)
   */
  addXmlSection(tag: string, content: string, attributes?: Record<string, string>): this {
    const attrs =
      attributes && Object.keys(attributes).length > 0
        ? " " +
          Object.entries(attributes)
            .map(([k, v]) => `${k}="${escapePromptXmlAttr(v)}"`)
            .join(" ")
        : "";
    const escaped = escapePromptXmlText(content);
    this.parts.push({
      content: `<${tag}${attrs}>\n${escaped}\n</${tag}>`,
      escape: false,
      tag,
    });
    return this;
  }

  /**
   * Add JSON block (auto-escaped if needed)
   */
  addJsonBlock(data: object, tag = "data"): this {
    const json = JSON.stringify(data, null, 2);
    return this.addXmlSection(tag, json);
  }

  /**
   * Add heading
   */
  addHeading(level: 1 | 2 | 3 | 4, text: string): this {
    const hash = "#".repeat(level);
    return this.addRaw(`\n${hash} ${text}\n`);
  }

  /**
   * Add list items
   */
  addList(items: string[], ordered = false): this {
    const listItems = items
      .map((item, i) => (ordered ? `${i + 1}. ${item}` : `- ${item}`))
      .join("\n");
    return this.addRaw(listItems);
  }

  /**
   * Build final user prompt
   */
  build(): string {
    return this.parts.map((p) => p.content).join("\n");
  }

  /**
   * Reset builder
   */
  reset(): this {
    this.parts = [];
    return this;
  }
}

/**
 * Convenience factory functions
 */
export const PromptFactory = {
  /**
   * Create a system prompt builder for a specific role
   */
  forRole: (role: PromptRole, language: string = "English"): PromptBuilder => {
    const builder = new PromptBuilder(role).setLanguage(language);

    // Add role-specific defaults
    const roleDescriptions: Record<PromptRole, string> = {
      "api-documentarian":
        "You are a Principal API Architect. Your task is to reverse-engineer source code and extract interface contracts. Output must strictly follow the OpenAPI 3.0+ specification in YAML format. Do not invent endpoints or parameters.",

      architect:
        "You are a Systems Architect conducting an engineering audit. Analyze the provided codebase to map component dependencies, state management patterns, and potential scaling bottlenecks. Focus on architectural trade-offs.",

      "architecture-writer":
        "You are a Staff Technical Writer. Translate codebase structures into a comprehensive ARCHITECTURE.md. Use Mermaid.js syntax for sequence and component diagrams. Focus on data-flow and system topology.",

      "changelog-writer":
        "You are a Release Manager. Analyze commit logs and diffs to generate user-centric release notes. Adhere strictly to the 'Keep a Changelog' standard. Group changes by Added, Changed, and Fixed.",

      "code-analyzer":
        "You are a Static Code Auditor. Scan the repository for technical debt, anti-patterns, code duplication, and maintainability scores. Provide evidence-based references to file names and line numbers.",

      "code-documenter":
        "You are a Technical Documentation Engineer. Generate clean, precise inline documentation (e.g., JSDoc, Docstrings, TSDoc). Adhere strictly to the language-specific formatting conventions and types present in the code.",

      "code-reviewer":
        "You are a Senior Peer Reviewer. Conduct an objective review focused on edge-case handling, runtime efficiency, and code readability. Provide constructive feedback with 'Before' and 'After' code examples.",

      "contributing-writer":
        "You are an Open Source Maintainer writing a CONTRIBUTING.md guide. Define clear engineering quality gates, local environment setup instructions, and branch-naming conventions matching the current repository style.",

      generic:
        "You are an Expert Technical Writer and Software Co-Pilot. Assist with general code explanation and documentation queries following modern software engineering best practices.",

      "readme-writer":
        "You are a Developer Relations Engineer. Write an executive-level README.md blueprint. Ensure it includes quick-start commands, configuration options, prerequisites, and a high-level value proposition of the system.",

      "security-sentinel":
        "You are an Offensive Security Engineer and Code Auditor. Scan source code for OWASP Top 10 vulnerabilities, insecure dependencies, secret leaks, and compliance flaws. Categorize findings by severity (High, Medium, Low).",
    };

    const selectedDescription = roleDescriptions[role];
    return builder.withRole(selectedDescription);
  },

  /**
   * Create a user prompt builder
   */
  user: (): UserPromptBuilder => new UserPromptBuilder(),
};
