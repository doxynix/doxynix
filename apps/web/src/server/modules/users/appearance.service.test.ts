import { beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_APPEARANCE } from "@/shared/lib/appearance-preferences";

import type { DbClient } from "@/server/core/db";

import { appearanceService } from "./appearance.service";

const USER_ID = "0195a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5d";

function makeDb(row: unknown = null): DbClient {
  return {
    userAppearance: {
      findUnique: vi.fn().mockResolvedValue(row),
      upsert: vi.fn().mockResolvedValue({}),
    },
  } as unknown as DbClient;
}

describe("appearanceService.getAppearance", () => {
  it("returns null when the user has no row", async () => {
    await expect(appearanceService.getAppearance(makeDb(), USER_ID)).resolves.toBeNull();
  });

  it("normalizes a corrupted field instead of failing", async () => {
    const db = makeDb({ preferences: { radius: "square", textScale: "large" } });
    const result = await appearanceService.getAppearance(db, USER_ID);

    expect(result).toMatchObject({
      radius: DEFAULT_APPEARANCE.radius,
      textScale: "large",
    });
  });
});

describe("appearanceService.updateAppearance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("merges a patch over the stored row", async () => {
    const db = makeDb({ preferences: { ...DEFAULT_APPEARANCE, radius: "soft" } });
    const result = await appearanceService.updateAppearance(db, USER_ID, { radius: "sharp" });

    expect(result.radius).toBe("sharp");
    expect(result.textScale).toBe(DEFAULT_APPEARANCE.textScale);
  });

  it("starts from defaults when the row is missing", async () => {
    const db = makeDb(null);
    const result = await appearanceService.updateAppearance(db, USER_ID, { theme: "ocean" });

    expect(result.theme).toBe("ocean");
    expect(result.radius).toBe(DEFAULT_APPEARANCE.radius);
  });

  it("upserts the merged preferences", async () => {
    const db = makeDb(null);
    const result = await appearanceService.updateAppearance(db, USER_ID, { mode: "dark" });

    expect(db.userAppearance.upsert).toHaveBeenCalledWith({
      create: { preferences: result, userId: USER_ID },
      update: { preferences: result },
      where: { userId: USER_ID },
    });
  });
});
