import { MessageCode } from "@doxynix/shared";
import { describe, expect, it } from "vitest";

import type { DbClient } from "@/server/core/db";

import {
  analysisRepo,
  MAX_REPO_DOCUMENTS,
  repoWithLatestAnalysisAndDocsSelect,
} from "./analysis.repository";

const ANALYSIS_ID = "0195f000-0000-7000-8000-000000000001";
const REPO_ID = "0195f000-0000-7000-8000-000000000002";
const WORKSPACE_ID = "0195f000-0000-7000-8000-000000000003";

const ANALYSIS = {
  commitSha: "abc123",
  complexityScore: 10,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  id: ANALYSIS_ID,
  metricsJson: { healthScore: 80 },
  onboardingScore: 70,
  resultJson: { facts: [] },
  score: 80,
  securityScore: 90,
  status: "DONE" as const,
  techDebtScore: 20,
};

type NestedArgs = {
  orderBy?: unknown;
  select?: Record<string, unknown>;
  take?: number;
  where?: Record<string, unknown>;
};

type Call = { select?: Record<string, NestedArgs>; where?: unknown };

// Captures every call so a test can prove the method issued one query, not two.
function makeDb(result: unknown) {
  const calls: Call[] = [];
  const findUnique = async (args: Call) => {
    calls.push(args);
    return result;
  };

  return { calls, db: { repo: { findUnique } } as unknown as DbClient };
}

function nested(call: Call | undefined, relation: "analyses" | "documents"): NestedArgs {
  return call?.select?.[relation] ?? {};
}

describe("analysisRepo.getRepoSnapshot", () => {
  it("resolves the requested analysis inside the one repo query", async () => {
    const { calls, db } = makeDb({ analyses: [ANALYSIS], id: REPO_ID });

    const repo = await analysisRepo.getRepoSnapshot(db, REPO_ID, WORKSPACE_ID, ANALYSIS_ID);

    expect(repo?.analyses[0]?.id).toBe(ANALYSIS_ID);
    expect(calls).toHaveLength(1);
    expect(nested(calls[0], "analyses")).toMatchObject({
      take: 1,
      where: { id: ANALYSIS_ID, status: "DONE" },
    });
  });

  it("asks for the latest completed analysis when no version is pinned", async () => {
    const { calls, db } = makeDb({ analyses: [ANALYSIS], id: REPO_ID });

    await analysisRepo.getRepoSnapshot(db, REPO_ID, WORKSPACE_ID);

    expect(calls).toHaveLength(1);
    expect(nested(calls[0], "analyses").where).toStrictEqual({ status: "DONE" });
  });

  it("returns null when the repo is missing", async () => {
    const { db } = makeDb(null);

    await expect(
      analysisRepo.getRepoSnapshot(db, REPO_ID, WORKSPACE_ID, ANALYSIS_ID),
    ).resolves.toBeNull();
  });

  it("throws ANALYSIS_VERSION_NOT_FOUND for an aid outside this repo's completed analyses", async () => {
    const { db } = makeDb({ analyses: [], id: REPO_ID });

    await expect(
      analysisRepo.getRepoSnapshot(db, REPO_ID, WORKSPACE_ID, ANALYSIS_ID),
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
      messageCode: MessageCode.ANALYSIS_VERSION_NOT_FOUND,
      publicMessage: "Analysis version not found",
    });
  });

  it("throws ANALYSIS_NOT_COMPLETED when the repo has no completed analysis", async () => {
    const { db } = makeDb({ analyses: [], id: REPO_ID });

    await expect(analysisRepo.getRepoSnapshot(db, REPO_ID, WORKSPACE_ID)).rejects.toMatchObject({
      code: "NOT_FOUND",
      messageCode: MessageCode.ANALYSIS_NOT_COMPLETED,
      publicMessage: "No completed analysis found",
    });
  });
});

describe("analysisRepo.getRepoSnapshotWithDocuments", () => {
  it("caps the no-aid document read and keeps newest-first order", async () => {
    const { calls, db } = makeDb({ analyses: [ANALYSIS], documents: [], id: REPO_ID });

    await analysisRepo.getRepoSnapshotWithDocuments(db, REPO_ID, WORKSPACE_ID);

    expect(calls).toHaveLength(1);
    expect(nested(calls[0], "documents")).toMatchObject({
      orderBy: { updatedAt: "desc" },
      take: MAX_REPO_DOCUMENTS,
    });
    expect(repoWithLatestAnalysisAndDocsSelect.documents.take).toBe(MAX_REPO_DOCUMENTS);
  });

  it("pins the documents and the analysis to the requested version", async () => {
    const { calls, db } = makeDb({ analyses: [ANALYSIS], documents: [], id: REPO_ID });

    await analysisRepo.getRepoSnapshotWithDocuments(db, REPO_ID, WORKSPACE_ID, ANALYSIS_ID);

    expect(calls).toHaveLength(1);
    expect(nested(calls[0], "documents").where).toStrictEqual({ analysisId: ANALYSIS_ID });
    expect(nested(calls[0], "analyses").where).toStrictEqual({
      id: ANALYSIS_ID,
      status: "DONE",
    });
  });

  it("throws ANALYSIS_VERSION_NOT_FOUND when the requested analysis is gone", async () => {
    const { db } = makeDb({ analyses: [], documents: [], id: REPO_ID });

    await expect(
      analysisRepo.getRepoSnapshotWithDocuments(db, REPO_ID, WORKSPACE_ID, ANALYSIS_ID),
    ).rejects.toMatchObject({ messageCode: MessageCode.ANALYSIS_VERSION_NOT_FOUND });
  });
});

describe("analysisRepo.getAnalysisPayloadForRepo", () => {
  it("returns the requested payload from a single query", async () => {
    const { calls, db } = makeDb({ analyses: [ANALYSIS] });

    const analysis = await analysisRepo.getAnalysisPayloadForRepo(
      db,
      REPO_ID,
      WORKSPACE_ID,
      ANALYSIS_ID,
    );

    expect(analysis?.id).toBe(ANALYSIS_ID);
    expect(calls).toHaveLength(1);
    expect(nested(calls[0], "analyses").where).toStrictEqual({
      id: ANALYSIS_ID,
      status: "DONE",
    });
  });

  it("returns null when the repo is missing", async () => {
    const { db } = makeDb(null);

    await expect(
      analysisRepo.getAnalysisPayloadForRepo(db, REPO_ID, WORKSPACE_ID, ANALYSIS_ID),
    ).resolves.toBeNull();
  });

  it("throws ANALYSIS_VERSION_NOT_FOUND for an unknown aid", async () => {
    const { db } = makeDb({ analyses: [] });

    await expect(
      analysisRepo.getAnalysisPayloadForRepo(db, REPO_ID, WORKSPACE_ID, ANALYSIS_ID),
    ).rejects.toMatchObject({
      messageCode: MessageCode.ANALYSIS_VERSION_NOT_FOUND,
      publicMessage: "Analysis version not found",
    });
  });
});

describe("analysisRepo.getRepoRef", () => {
  it("selects only the columns and ids the docs viewer reads", async () => {
    const { calls, db } = makeDb({ analyses: [{ id: ANALYSIS_ID }], id: REPO_ID });

    const ref = await analysisRepo.getRepoRef(db, REPO_ID, WORKSPACE_ID, ANALYSIS_ID);

    expect(ref?.analyses[0]?.id).toBe(ANALYSIS_ID);
    expect(calls).toHaveLength(1);
    expect(Object.keys(calls[0]?.select ?? {}).sort()).toStrictEqual([
      "analyses",
      "defaultBranch",
      "id",
      "name",
      "owner",
      "url",
    ]);
    expect(nested(calls[0], "analyses").select).toStrictEqual({ id: true });
  });

  it("throws ANALYSIS_NOT_COMPLETED when the repo has no completed analysis", async () => {
    const { db } = makeDb({ analyses: [], id: REPO_ID });

    await expect(analysisRepo.getRepoRef(db, REPO_ID, WORKSPACE_ID)).rejects.toMatchObject({
      messageCode: MessageCode.ANALYSIS_NOT_COMPLETED,
      publicMessage: "No completed analysis found",
    });
  });

  it("throws ANALYSIS_VERSION_NOT_FOUND when the pinned analysis is missing", async () => {
    const { db } = makeDb({ analyses: [], id: REPO_ID });

    await expect(
      analysisRepo.getRepoRef(db, REPO_ID, WORKSPACE_ID, ANALYSIS_ID),
    ).rejects.toMatchObject({
      messageCode: MessageCode.ANALYSIS_VERSION_NOT_FOUND,
      publicMessage: "Analysis version not found",
    });
  });
});
