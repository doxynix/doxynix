import { beforeEach, describe, expect, it, vi } from "vitest";

import { REALTIME_CONFIG } from "@/shared/config/realtime";

const mocks = vi.hoisted(() => ({
  addFiles: vi.fn(),
  clear: vi.fn(),
  publish: vi.fn(),
  removeFile: vi.fn(),
}));

vi.mock("@/server/core/redis", () => ({
  redisService: {
    staging: { addFiles: mocks.addFiles, clear: mocks.clear, removeFile: mocks.removeFile },
  },
}));

vi.mock("@/server/core/realtime", () => ({
  realtimeService: { user: () => ({ publish: mocks.publish }) },
}));

import { stagingService } from "./staging.service";

const USER_ID = "user-1";
const REPO_ID = "018f0000-0000-7000-8000-0000000000cc";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.publish.mockResolvedValue(undefined);
});

describe("stagingService realtime", () => {
  it("publishes the staging event when a file is staged", async () => {
    mocks.addFiles.mockResolvedValue(1);

    await expect(
      stagingService.stageFile(USER_ID, REPO_ID, "src/a.ts", "x"),
    ).resolves.toStrictEqual({ stagedCount: 1, success: true });

    expect(mocks.publish).toHaveBeenCalledWith(REALTIME_CONFIG.events.user.stagingUpdated, {});
  });

  it("publishes the staging event when a file is unstaged", async () => {
    mocks.removeFile.mockResolvedValue(0);

    await stagingService.unstageFile(USER_ID, REPO_ID, "src/a.ts");

    expect(mocks.publish).toHaveBeenCalledWith(REALTIME_CONFIG.events.user.stagingUpdated, {});
  });

  it("publishes the staging event when the staging area is cleared", async () => {
    mocks.clear.mockResolvedValue(undefined);

    await stagingService.clearStaging(USER_ID, REPO_ID);

    expect(mocks.publish).toHaveBeenCalledWith(REALTIME_CONFIG.events.user.stagingUpdated, {});
    expect(mocks.publish).not.toHaveBeenCalledWith(
      REALTIME_CONFIG.events.user.analysisUpdated,
      expect.anything(),
    );
  });
});
