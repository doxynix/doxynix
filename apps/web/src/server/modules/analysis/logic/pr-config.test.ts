import { PRCommentStyle, PRFocusArea } from "@doxynix/shared";
import { describe, expect, it, vi } from "vitest";

import type { DbClient } from "@/server/core/db";

import { PATH_PATTERNS } from "../engine/core/project-policy-rules";
import { PRConfigService } from "./pr-config";

const SYSTEM_IGNORES = [
  ...PATH_PATTERNS.IGNORE,
  ...PATH_PATTERNS.GENERATED,
  ...PATH_PATTERNS.ASSET,
];

const makeRow = (overrides: Partial<Record<string, unknown>> = {}) => ({
  ciSkip: false,
  commentStyle: PRCommentStyle.DETAILED,
  enabled: true,
  excludePatterns: ["**/vendor/**"],
  focusAreas: [PRFocusArea.SECURITY],
  tokenBudget: 50_000,
  ...overrides,
});

const makeDb = (overrides: Record<string, unknown> = {}) => {
  const findFirst = vi.fn();
  const update = vi.fn();
  return {
    db: {
      pullRequestAnalysisConfig: { findFirst },
      repo: { update },
      ...overrides,
    } as unknown as DbClient,
    findFirst,
    update,
  };
};

describe("PRConfigService.getConfig", () => {
  it("возвращает DEFAULT, когда конфигурация не найдена", async () => {
    const { db, findFirst } = makeDb();
    findFirst.mockResolvedValue(null);

    const config = await PRConfigService.getConfig("repo-1", db);

    expect(config).toEqual({
      ciSkip: false,
      commentStyle: PRCommentStyle.DETAILED,
      enabled: false,
      excludePatterns: SYSTEM_IGNORES,
      focusAreas: [PRFocusArea.SECURITY, PRFocusArea.PERFORMANCE],
      tokenBudget: 30_000,
    });
    expect(findFirst).toHaveBeenCalledWith({ where: { repo: { publicId: "repo-1" } } });
  });

  it("объединяет excludePatterns с системными игнорами", async () => {
    const { db, findFirst } = makeDb();
    findFirst.mockResolvedValue(makeRow());

    const config = await PRConfigService.getConfig("repo-1", db);

    expect(config.enabled).toBe(true);
    expect(config.tokenBudget).toBe(50_000);
    expect(config.focusAreas).toEqual([PRFocusArea.SECURITY]);
    expect(config.excludePatterns).toEqual(
      expect.arrayContaining([...SYSTEM_IGNORES, "**/vendor/**"]),
    );
  });
});

describe("PRConfigService.setTokenBudget", () => {
  it("зажимает бюджет снизу до 10k", async () => {
    const { db, findFirst, update } = makeDb();
    findFirst.mockResolvedValue(makeRow());

    await PRConfigService.setTokenBudget("repo-1", 5000, db);

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          prAnalysisConfig: expect.objectContaining({
            upsert: expect.objectContaining({
              create: expect.objectContaining({ tokenBudget: 10_000 }),
              update: expect.objectContaining({ tokenBudget: 10_000 }),
            }),
          }),
        }),
      }),
    );
  });

  it("зажимает бюджет сверху до 100k", async () => {
    const { db, findFirst, update } = makeDb();
    findFirst.mockResolvedValue(makeRow());

    await PRConfigService.setTokenBudget("repo-1", 500_000, db);

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          prAnalysisConfig: expect.objectContaining({
            upsert: expect.objectContaining({
              update: expect.objectContaining({ tokenBudget: 100_000 }),
            }),
          }),
        }),
      }),
    );
  });
});

describe("PRConfigService.updateConfig", () => {
  it("заполняет create дефолтами и убирает tokenBudget из update при отсутствии", async () => {
    const { db, findFirst, update } = makeDb();
    findFirst.mockResolvedValue(makeRow());

    const result = await PRConfigService.updateConfig("repo-1", { enabled: true }, db);

    expect(update).toHaveBeenCalledWith({
      data: {
        prAnalysisConfig: {
          upsert: {
            create: {
              ciSkip: false,
              commentStyle: PRCommentStyle.DETAILED,
              enabled: true,
              excludePatterns: [],
              focusAreas: [PRFocusArea.SECURITY, PRFocusArea.PERFORMANCE],
              tokenBudget: 30_000,
            },
            update: { enabled: true },
          },
        },
      },
      where: { publicId: "repo-1" },
    });
    expect(result).toEqual(expect.objectContaining({ enabled: true }));
  });
});

describe("PRConfigService.enable/disablePRAnalysis", () => {
  it("включает через updateConfig", async () => {
    const { db, findFirst, update } = makeDb();
    findFirst.mockResolvedValue(makeRow());

    await PRConfigService.enablePRAnalysis("repo-1", db);

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          prAnalysisConfig: expect.objectContaining({
            upsert: expect.objectContaining({
              create: expect.objectContaining({ enabled: true }),
              update: { enabled: true },
            }),
          }),
        }),
      }),
    );
  });

  it("отключает через updateConfig", async () => {
    const { db, findFirst, update } = makeDb();
    findFirst.mockResolvedValue(makeRow());

    await PRConfigService.disablePRAnalysis("repo-1", db);

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          prAnalysisConfig: expect.objectContaining({
            upsert: expect.objectContaining({
              create: expect.objectContaining({ enabled: false }),
              update: { enabled: false },
            }),
          }),
        }),
      }),
    );
  });
});
