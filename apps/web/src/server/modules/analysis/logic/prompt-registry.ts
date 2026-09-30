import type { LLMTaskType } from "../engine/core/scoring-constants";

export type PromptMetadata = {
  createdAt: Date;

  description: string;

  id: string;

  maxContextSize?: number;

  modifiedAt: Date;

  name: string;

  outputFormat: "json" | "markdown" | "text" | "xml";

  requiresContext: boolean;

  role: string;

  tags: string[];

  taskType: LLMTaskType;

  type: "both" | "system" | "user";

  version: string;
};

type RegisteredPrompt = {
  builderFn: (params: Record<string, unknown>) => string;
  metadata: PromptMetadata;
};

export const PROMPT_IDS = {
  API_DOC: "api-documentarian",
  ARCHITECT: "architect",
  README: "readme-writer",
  SENTINEL: "security-sentinel",
} as const;

type PromptId = (typeof PROMPT_IDS)[keyof typeof PROMPT_IDS];

export class PromptRegistry {
  private aliases: Map<string, string> = new Map();
  private prompts: Map<string, RegisteredPrompt> = new Map();

  alias(oldName: string, newPromptId: string): this {
    if (!this.prompts.has(newPromptId)) {
      throw new Error(`Target prompt "${newPromptId}" not found`);
    }
    this.aliases.set(oldName, newPromptId);
    return this;
  }

  build(promptId: PromptId, params: Record<string, unknown> = {}): string {
    const resolved = this.aliases.get(promptId) ?? promptId;
    const prompt = this.prompts.get(resolved);

    if (!prompt) {
      throw new Error(`Prompt "${promptId}" not found in registry`);
    }

    return prompt.builderFn(params);
  }

  clear(): void {
    this.prompts.clear();
    this.aliases.clear();
  }

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

  getAllMetadata(): PromptMetadata[] {
    return Array.from(this.prompts.values()).map((p) => p.metadata);
  }

  getByRole(role: string): PromptMetadata[] {
    return Array.from(this.prompts.values())
      .filter((p) => p.metadata.role === role)
      .map((p) => p.metadata);
  }

  getByTaskType(taskType: LLMTaskType): PromptMetadata[] {
    return Array.from(this.prompts.values())
      .filter((p) => p.metadata.taskType === taskType)
      .map((p) => p.metadata);
  }

  getMetadata(promptId: string): null | PromptMetadata {
    const resolved = this.aliases.get(promptId) ?? promptId;
    const prompt = this.prompts.get(resolved);
    return prompt?.metadata ?? null;
  }

  getStats(): {
    byOutputFormat: Record<string, number>;
    byRole: Set<string>;
    byTaskType: Partial<Record<LLMTaskType, number>>;
    totalPrompts: number;
  } {
    const stats = {
      byOutputFormat: {} as Record<string, number>,
      byRole: new Set<string>(),
      byTaskType: {} as Partial<Record<LLMTaskType, number>>,
      totalPrompts: this.prompts.size,
    };

    for (const prompt of this.prompts.values()) {
      const { outputFormat, role, taskType } = prompt.metadata;

      stats.byTaskType[taskType] = (stats.byTaskType[taskType] ?? 0) + 1;
      stats.byOutputFormat[outputFormat] = (stats.byOutputFormat[outputFormat] ?? 0) + 1;
      stats.byRole.add(role);
    }

    return stats;
  }

  has(promptId: string): boolean {
    const resolved = this.aliases.get(promptId) ?? promptId;
    return this.prompts.has(resolved);
  }

  register(metadata: PromptMetadata, builderFn: (params: Record<string, unknown>) => string): this {
    if (this.prompts.has(metadata.id)) {
      throw new Error(`Prompt with ID "${metadata.id}" is already registered`);
    }

    this.prompts.set(metadata.id, { builderFn, metadata });
    return this;
  }
}

let globalRegistry: null | PromptRegistry = null;

export function getGlobalPromptRegistry(): PromptRegistry {
  globalRegistry ??= new PromptRegistry();
  return globalRegistry;
}

export function resetGlobalPromptRegistry(): void {
  globalRegistry = null;
}

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
