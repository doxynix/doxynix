import { describe, expect, it } from "vitest";

import type { PromptMetadata } from "./prompt-registry";
import {
  createPromptMetadata,
  getGlobalPromptRegistry,
  PROMPT_IDS,
  PromptRegistry,
  resetGlobalPromptRegistry,
} from "./prompt-registry";

const VALID_BUILD_IDS = [
  "api-documentarian",
  "architect",
  "readme-writer",
  "security-sentinel",
] as const;
const asBuildId = (id: string) => id as (typeof VALID_BUILD_IDS)[number];

const makeRegistry = () => {
  const registry = new PromptRegistry();
  const builderFn = (params: Record<string, unknown>) =>
    `payload:${String(params.topic ?? "none")}`;
  const metadata = (id: string, overrides: Partial<PromptMetadata> = {}) =>
    createPromptMetadata({ id, ...overrides });
  return { builderFn, metadata, registry };
};

describe("PromptRegistry", () => {
  it("register + has + getMetadata", () => {
    const { registry, metadata, builderFn } = makeRegistry();

    registry.register(metadata("readme-writer", { name: "Readme" }), builderFn);

    expect(registry.has("readme-writer")).toBe(true);
    expect(registry.has("nope")).toBe(false);
    expect(registry.getMetadata("readme-writer")?.name).toBe("Readme");
    expect(registry.getMetadata("nope")).toBeNull();
  });

  it("регистрация дубликата бросает ошибку", () => {
    const { registry, metadata, builderFn } = makeRegistry();

    registry.register(metadata("readme-writer"), builderFn);

    expect(() => registry.register(metadata("readme-writer"), builderFn)).toThrow(
      'Prompt with ID "readme-writer" is already registered',
    );
  });

  it("build возвращает результат builderFn с параметрами", () => {
    const { registry, metadata, builderFn } = makeRegistry();

    registry.register(metadata("readme-writer"), builderFn);

    expect(registry.build(asBuildId("readme-writer"), { topic: "t" })).toBe("payload:t");
    expect(registry.build(asBuildId("readme-writer"))).toBe("payload:none");
  });

  it("build несуществующего промпта бросает ошибку", () => {
    const { registry } = makeRegistry();

    expect(() => registry.build(asBuildId("missing"))).toThrow(
      'Prompt "missing" not found in registry',
    );
  });

  it("alias резолвится к target-промпту", () => {
    const { registry, metadata, builderFn } = makeRegistry();

    registry.register(metadata("readme-writer"), builderFn);
    registry.alias("legacy-readme", "readme-writer");

    expect(registry.build(asBuildId("legacy-readme"), { topic: "a" })).toBe("payload:a");
    expect(registry.getMetadata("legacy-readme")?.id).toBe("readme-writer");
    expect(registry.has("legacy-readme")).toBe(true);
  });

  it("alias с неизвестным target бросает ошибку", () => {
    const { registry } = makeRegistry();

    expect(() => registry.alias("old", "missing-target")).toThrow(
      'Target prompt "missing-target" not found',
    );
  });

  it("getByRole фильтрует по роли", () => {
    const { registry, metadata, builderFn } = makeRegistry();

    registry.register(metadata("architect", { role: "arch" }), builderFn);
    registry.register(metadata("readme-writer", { role: "writer" }), builderFn);

    expect(registry.getByRole("arch").map((m) => m.id)).toEqual(["architect"]);
    expect(registry.getByRole("nobody")).toEqual([]);
  });

  it("getByTaskType фильтрует по типу задачи", () => {
    const { registry, metadata, builderFn } = makeRegistry();

    registry.register(metadata("architect", { taskType: "default" }), builderFn);
    registry.register(metadata("security-sentinel", { taskType: "creative" }), builderFn);

    expect(registry.getByTaskType("creative").map((m) => m.id)).toEqual(["security-sentinel"]);
    expect(registry.getByTaskType("classification")).toEqual([]);
  });

  it("getAllMetadata возвращает все метаданные", () => {
    const { registry, metadata, builderFn } = makeRegistry();

    registry.register(metadata("architect"), builderFn);
    registry.register(metadata("readme-writer"), builderFn);

    expect(
      registry
        .getAllMetadata()
        .map((m) => m.id)
        .sort(),
    ).toEqual(["architect", "readme-writer"]);
  });

  it("exportAsJson возвращает метаданные с ISO-датами", () => {
    const { registry, metadata, builderFn } = makeRegistry();

    registry.register(metadata("readme-writer"), builderFn);

    const exported = registry.exportAsJson() as Record<string, { metadata: { createdAt: string } }>;

    expect(Object.keys(exported)).toEqual(["readme-writer"]);
    expect(exported["readme-writer"]?.metadata.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T.*Z$/);
  });

  it("getStats считает totalPrompts, byOutputFormat, byRole, byTaskType", () => {
    const { registry, metadata, builderFn } = makeRegistry();

    registry.register(
      metadata("architect", { outputFormat: "text", role: "arch", taskType: "default" }),
      builderFn,
    );
    registry.register(
      metadata("readme-writer", { outputFormat: "json", role: "writer", taskType: "creative" }),
      builderFn,
    );
    registry.register(
      metadata("security-sentinel", {
        outputFormat: "text",
        role: "sentinel",
        taskType: "creative",
      }),
      builderFn,
    );

    const stats = registry.getStats();

    expect(stats.totalPrompts).toBe(3);
    expect(stats.byOutputFormat).toEqual({ json: 1, text: 2 });
    expect(stats.byRole).toEqual(new Set(["arch", "writer", "sentinel"]));
    expect(stats.byTaskType).toEqual({ creative: 2, default: 1 });
  });

  it("clear очищает промпты и алиасы", () => {
    const { registry, metadata, builderFn } = makeRegistry();

    registry.register(metadata("readme-writer"), builderFn).alias("old", "readme-writer");
    registry.clear();

    expect(registry.has("readme-writer")).toBe(false);
    expect(registry.has("old")).toBe(false);
    expect(registry.getStats().totalPrompts).toBe(0);
  });
});

describe("глобальный реестр", () => {
  it("getGlobalPromptRegistry возвращает один экземпляр до reset", () => {
    expect(getGlobalPromptRegistry()).toBe(getGlobalPromptRegistry());
  });

  it("resetGlobalPromptRegistry создаёт новый экземпляр", () => {
    const first = getGlobalPromptRegistry();

    resetGlobalPromptRegistry();

    expect(getGlobalPromptRegistry()).not.toBe(first);
  });
});

describe("createPromptMetadata / PROMPT_IDS", () => {
  it("возвращает дефолтные значения", () => {
    const meta = createPromptMetadata({});

    expect(meta).toMatchObject({
      description: "No description provided",
      id: "unknown",
      name: "Unknown Prompt",
      outputFormat: "text",
      requiresContext: false,
      role: "generic",
      tags: [],
      taskType: "default",
      type: "system",
      version: "1.0.0",
    });
    expect(meta.createdAt).toBe(meta.modifiedAt);
  });

  it("применяет overrides поверх дефолтов", () => {
    const createdAt = new Date("2024-01-01T00:00:00.000Z");

    const meta = createPromptMetadata({ createdAt, id: "p1", name: "N" });

    expect(meta.id).toBe("p1");
    expect(meta.name).toBe("N");
    expect(meta.createdAt).toBe(createdAt);
    expect(meta.role).toBe("generic");
  });

  it("PROMPT_IDS фиксирует идентификаторы", () => {
    expect(PROMPT_IDS).toEqual({
      API_DOC: "api-documentarian",
      ARCHITECT: "architect",
      README: "readme-writer",
      SENTINEL: "security-sentinel",
    });
  });
});
