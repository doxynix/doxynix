/**
 * PromptBuilder
 * Fluent API for constructing system and user prompts with consistent structure.
 */

import { escapePromptXmlAttr, escapePromptXmlText } from "./string-utils";

export type PromptRole =
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

export type PromptSection = {
  content: string;
  title: string;
};

/**
 * FluentPromptBuilder for consistent prompt construction
 * Supports method chaining for readability
 */
export class PromptBuilder {
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
      `# OUTPUT_SCHEMA\nReturn ONLY a valid JSON object matching this structure:\n\`\`\`json\n${JSON.stringify(schema, null, 2)}\n\`\`\``
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
   * Set language awareness in output
   */
  withLanguageNotice(): this {
    if (this.language && this.language !== "English") {
      const notice = `\n## LANGUAGE\nOutput ALL text in **${this.language}**.`;
      const existing = Array.from(this.sections.values()).join("\n");
      this.sections.clear();
      this.sections.set("_combined", existing + notice);
    }
    return this;
  }

  /**
   * Build the final system prompt
   */
  buildSystem(): string {
    const sections: string[] = [];

    // Order matters: role → constraints → grounding → task → strategy → output
    const order = ["role", "constraints", "grounding", "task", "strategy", "output"];

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
        "You are a Senior API Documentation Specialist. You reverse-engineer specifications from code.",
      architect: "You are an Elite Software Architect and Cartographer.",
      "architecture-writer":
        "You are a Lead Software Architect. Your task is to write ARCHITECTURE.md.",
      "changelog-writer": "You are a Release Manager.",
      "code-analyzer":
        "You are a Principal Software Engineer producing evidence-based repository intelligence.",
      "code-documenter": "You are a Polyglot Documentation Engineer.",
      "code-reviewer": "You are a Senior Code Reviewer and Security Expert.",
      "contributing-writer": "You are an Open Source Maintainer.",
      generic: "You are an AI assistant.",
      "readme-writer":
        "You are a Developer Advocate writing accurate repository documentation from verified facts.",
      "security-sentinel":
        "You are a Cyber Security Sentinel AI. Your sole purpose is to filter input for a Code Analysis Service.",
    };

    return builder.withRole(roleDescriptions[role]);
  },

  /**
   * Create a user prompt builder
   */
  user: (): UserPromptBuilder => new UserPromptBuilder(),
};
