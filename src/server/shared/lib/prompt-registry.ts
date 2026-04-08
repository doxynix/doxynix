/**
 * PromptRegistry
 * Central registry for all system and user prompts in the application.
 * Provides versioning, metadata, and dynamic retrieval of prompts.
 */

import type { LLMTaskType } from "@/server/shared/engine/core/scoring-constants";

/**
 * Metadata about a registered prompt
 */
export interface PromptMetadata {
  /** Created date */
  createdAt: Date;

  /** Description of what this prompt does */
  description: string;

  /** Unique prompt identifier */
  id: string;

  /** Maximum recommended input size in bytes */
  maxContextSize?: number;

  /** Last modified date */
  modifiedAt: Date;

  /** Human-readable name */
  name: string;

  /** Output format expected from LLM */
  outputFormat: "json" | "markdown" | "text" | "xml";

  /** Whether this prompt requires evidence/context input */
  requiresContext: boolean;

  /** Role/persona for this prompt */
  role: string;

  /** Tags for categorization */
  tags: string[];

  /** Type of task this prompt is used for LLM temperature strategy */
  taskType: LLMTaskType;

  /** Whether this is a system or user prompt */
  type: "system" | "user" | "both";

  /** Current version (for tracking updates) */
  version: string;
}

/**
 * Represents a registered prompt plus its builder function
 */
interface RegisteredPrompt {
  builderFn: (params: Record<string, unknown>) => string;
  metadata: PromptMetadata;
}

/**
 * PromptRegistry: Central management of all prompts
 */
export class PromptRegistry {
  private prompts: Map<string, RegisteredPrompt> = new Map();
  private aliases: Map<string, string> = new Map(); // For backward compatibility

  /**
   * Register a new prompt
   */
  register(metadata: PromptMetadata, builderFn: (params: Record<string, unknown>) => string): this {
    if (this.prompts.has(metadata.id)) {
      throw new Error(`Prompt with ID "${metadata.id}" is already registered`);
    }

    this.prompts.set(metadata.id, { builderFn, metadata });
    return this;
  }

  /**
   * Create an alias for backward compatibility
   */
  alias(oldName: string, newPromptId: string): this {
    if (!this.prompts.has(newPromptId)) {
      throw new Error(`Target prompt "${newPromptId}" not found`);
    }
    this.aliases.set(oldName, newPromptId);
    return this;
  }

  /**
   * Get prompt metadata by ID
   */
  getMetadata(promptId: string): PromptMetadata | null {
    const resolved = this.aliases.get(promptId) ?? promptId;
    const prompt = this.prompts.get(resolved);
    return prompt?.metadata ?? null;
  }

  /**
   * Get all registered prompts
   */
  getAllMetadata(): PromptMetadata[] {
    return Array.from(this.prompts.values()).map((p) => p.metadata);
  }

  /**
   * Get all prompts by task type
   */
  getByTaskType(taskType: LLMTaskType): PromptMetadata[] {
    return Array.from(this.prompts.values())
      .filter((p) => p.metadata.taskType === taskType)
      .map((p) => p.metadata);
  }

  /**
   * Get all prompts by role
   */
  getByRole(role: string): PromptMetadata[] {
    return Array.from(this.prompts.values())
      .filter((p) => p.metadata.role === role)
      .map((p) => p.metadata);
  }

  /**
   * Build a prompt by ID with given parameters
   */
  build(promptId: string, params: Record<string, unknown> = {}): string {
    const resolved = this.aliases.get(promptId) ?? promptId;
    const prompt = this.prompts.get(resolved);

    if (!prompt) {
      throw new Error(`Prompt "${promptId}" not found in registry`);
    }

    return prompt.builderFn(params);
  }

  /**
   * Check if a prompt is registered
   */
  has(promptId: string): boolean {
    const resolved = this.aliases.get(promptId) ?? promptId;
    return this.prompts.has(resolved);
  }

  /**
   * Get stats about registered prompts
   */
  getStats(): {
    byOutputFormat: Record<string, number>;
    byRole: Set<string>;
    byTaskType: Record<LLMTaskType, number>;
    totalPrompts: number;
  } {
    const stats = {
      byOutputFormat: {} as Record<string, number>,
      byRole: new Set<string>(),
      byTaskType: {} as Record<LLMTaskType, number>,
      totalPrompts: this.prompts.size,
    };

    for (const prompt of this.prompts.values()) {
      const { outputFormat, role, taskType } = prompt.metadata;

      stats.byTaskType[taskType] = stats.byTaskType[taskType] + 1;
      stats.byOutputFormat[outputFormat] = (stats.byOutputFormat[outputFormat] ?? 0) + 1;
      stats.byRole.add(role);
    }

    return stats;
  }

  /**
   * Export registry as JSON for documentation
   */
  exportAsJson(): object {
    const data: Record<string, unknown> = {};

    for (const [id, prompt] of this.prompts.entries()) {
      data[id] = {
        metadata: {
          ...prompt.metadata,
          createdAt: prompt.metadata.createdAt.toISOString(),
          modifiedAt: prompt.metadata.modifiedAt.toISOString(),
        },
      };
    }

    return data;
  }

  /**
   * Clear all registered prompts (for testing)
   */
  clear(): void {
    this.prompts.clear();
    this.aliases.clear();
  }
}

/**
 * Global prompt registry singleton
 */
let globalRegistry: PromptRegistry | null = null;

/**
 * Get or create global prompt registry
 */
export function getGlobalPromptRegistry(): PromptRegistry {
  if (!globalRegistry) {
    globalRegistry = new PromptRegistry();
  }
  return globalRegistry;
}

/**
 * Reset global registry (for testing)
 */
export function resetGlobalPromptRegistry(): void {
  globalRegistry = null;
}

/**
 * Helper to create prompt metadata
 */
export function createPromptMetadata(overrides: Partial<PromptMetadata>): PromptMetadata {
  const now = new Date();
  return {
    createdAt: now,
    description: "No description provided",
    id: "unknown",
    modifiedAt: now,
    name: "Unknown Prompt",
    outputFormat: "text",
    requiresContext: false,
    role: "generic",
    tags: [],
    taskType: "default",
    type: "system",
    version: "1.0.0",
    ...overrides,
  };
}
