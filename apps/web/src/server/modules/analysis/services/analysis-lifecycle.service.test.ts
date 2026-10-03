import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DbClient } from "@/server/core/db";

const { trackMock, triggerMock } = vi.hoisted(() => ({
  trackMock: vi.fn(),
  triggerMock: vi.fn(),
}));

vi.mock("@/server/core/posthog-events", () => ({
  trackServerEvent: trackMock,
}));

vi.mock("@trigger.dev/sdk", () => ({
  auth: {},
  runs: {},
  tasks: { trigger: triggerMock },
}));

import { analysisLifecycleService } from "./analysis-lifecycle.service";

function buildDb(): DbClient {
  return {
    analysis: {
      create: vi.fn().mockResolvedValue({ id: "analysis-1" }),
      update: vi.fn().mockResolvedValue({ id: "analysis-1" }),
    },
    repo: {
      findFirst: vi.fn().mockResolvedValue({ id: "repo-1", name: "demo", owner: "acme" }),
    },
  } as unknown as DbClient;
}

describe("analysisLifecycleService.analyze analytics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    triggerMock.mockResolvedValue({ id: "handle-1", publicAccessToken: "tok" });
  });

  it("tracks repo_analysis_queued with the analysis id and the caller's user", async () => {
    await analysisLifecycleService.analyze(buildDb(), "user-1", {
      branch: "main",
      docTypes: ["api", "readme"],
      files: ["a.ts", "b.ts"],
      instructions: "be brief",
      language: "en",
      repoId: "repo-1",
    });

    expect(trackMock).toHaveBeenCalledTimes(1);
    expect(trackMock).toHaveBeenCalledWith(
      "repo_analysis_queued",
      {
        analysis_id: "analysis-1",
        doc_types_count: 2,
        has_custom_instructions: true,
        language: "en",
        selected_branch: "main",
        selected_files_count: 2,
      },
      "user-1",
    );
  });

  it("nulls the branch and reports no custom instructions when omitted", async () => {
    await analysisLifecycleService.analyze(buildDb(), "user-2", {
      docTypes: [],
      files: [],
      language: "ru",
      repoId: "repo-1",
    });

    expect(trackMock).toHaveBeenCalledWith(
      "repo_analysis_queued",
      expect.objectContaining({
        has_custom_instructions: false,
        selected_branch: null,
        selected_files_count: 0,
      }),
      "user-2",
    );
  });

  it("does not track when repository access is denied", async () => {
    const db = buildDb();
    vi.mocked(db.repo.findFirst).mockResolvedValue(null);

    await expect(
      analysisLifecycleService.analyze(db, "user-1", {
        docTypes: [],
        files: [],
        language: "en",
        repoId: "missing",
      }),
    ).rejects.toThrow("Repository not found or access denied");

    expect(trackMock).not.toHaveBeenCalled();
  });

  it("does not track when the task could not be triggered", async () => {
    triggerMock.mockRejectedValue(new Error("queue unavailable"));

    await expect(
      analysisLifecycleService.analyze(buildDb(), "user-1", {
        docTypes: [],
        files: [],
        language: "en",
        repoId: "repo-1",
      }),
    ).rejects.toThrow("queue unavailable");

    expect(trackMock).not.toHaveBeenCalled();
  });
});
