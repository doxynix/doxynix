import { randomUUID } from "node:crypto";

import type { DocType } from "@doxynix/shared";
import { beforeEach, describe, expect, it } from "vitest";

import { prisma } from "@/server/core/db";
import { analysisRepo, loadDocumentsPerType } from "@/server/modules/analysis/analysis.repository";

import { cleanupDatabase, createTestUser } from "../helpers";

async function seedRepo(name: string) {
  const owner = await createTestUser(name);
  const repo = await owner.db.repo.create({
    data: {
      createdByUserId: owner.user.id,
      defaultBranch: "main",
      githubId: Math.floor(Math.random() * 1_000_000_000),
      name: `repo-${name.toLowerCase()}`,
      owner: name.toLowerCase(),
      url: `https://github.com/${name.toLowerCase()}/repo`,
      visibility: "PUBLIC",
      workspaceId: owner.workspace.id,
    },
  });

  return { owner, repoId: repo.id, workspaceId: owner.workspace.id };
}

async function seedAnalysis(repoId: string, commitSha: string, createdAt: Date) {
  // `createdAt` is pinned so "latest completed analysis" is deterministic across runs.
  return prisma.analysis.create({
    data: { commitSha, createdAt, repoId, status: "DONE" },
  });
}

async function seedDocument(input: {
  analysisId?: string;
  content?: string;
  path?: string;
  repoId: string;
  type: DocType;
  updatedAt?: Date;
}) {
  return prisma.document.create({
    data: {
      content: input.content ?? `# ${input.type} document`,
      repoId: input.repoId,
      type: input.type,
      updatedAt: input.updatedAt,
      version: randomUUID(),
      ...(input.path == null ? {} : { path: input.path }),
      ...(input.analysisId == null ? {} : { analysisId: input.analysisId }),
    },
    select: { id: true, type: true, updatedAt: true },
  });
}

describe("loadDocumentsPerType", () => {
  beforeEach(async () => {
    await cleanupDatabase();
  });

  it("keeps every document type when one type has ten versions", async () => {
    const { repoId, workspaceId } = await seedRepo("docs_per_type_eviction");
    const analysis = await seedAnalysis(repoId, "sha-eviction", new Date("2026-01-01T00:00:00Z"));

    const newest = new Date("2026-01-11T00:00:00Z");
    for (const index of Array.from({ length: 10 }, (_, offset) => offset)) {
      await seedDocument({
        analysisId: analysis.id,
        repoId,
        type: "README",
        updatedAt: new Date(newest.getTime() - index * 86_400_000),
      });
    }
    await seedDocument({
      analysisId: analysis.id,
      repoId,
      type: "ARCHITECTURE",
      updatedAt: new Date("2025-01-01T00:00:00Z"),
    });

    const docs = await loadDocumentsPerType(prisma, repoId, workspaceId, { perType: 1 });

    expect(docs.filter((doc) => doc.type === "README")).toHaveLength(1);
    expect(docs.filter((doc) => doc.type === "ARCHITECTURE")).toHaveLength(1);
    expect(new Set(docs.map((doc) => doc.type))).toStrictEqual(new Set(["README", "ARCHITECTURE"]));
  });

  it("returns one row per type when two analyses carry the same kind", async () => {
    const { repoId, workspaceId } = await seedRepo("docs_per_type_two_analyses");
    const older = await seedAnalysis(repoId, "sha-a", new Date("2026-01-01T00:00:00Z"));
    const latest = await seedAnalysis(repoId, "sha-b", new Date("2026-02-01T00:00:00Z"));
    await seedDocument({
      analysisId: older.id,
      path: "README.md",
      repoId,
      type: "README",
      updatedAt: new Date("2026-03-01T00:00:00Z"),
    });
    await seedDocument({
      analysisId: latest.id,
      path: "README.md",
      repoId,
      type: "README",
      updatedAt: new Date("2026-02-01T00:00:00Z"),
    });

    const docs = await analysisRepo.loadLatestDocumentsWithContent(prisma, repoId, workspaceId);

    expect(docs).toHaveLength(1);
    expect(docs[0]?.type).toBe("README");
  });

  it("returns the newest versions of a type first", async () => {
    const { repoId, workspaceId } = await seedRepo("docs_per_type_order");
    const analysis = await seedAnalysis(repoId, "sha-order", new Date("2026-01-01T00:00:00Z"));
    const newest = await seedDocument({
      analysisId: analysis.id,
      repoId,
      type: "README",
      updatedAt: new Date("2026-03-01T00:00:00Z"),
    });

    await seedDocument({
      analysisId: analysis.id,
      repoId,
      type: "README",
      updatedAt: new Date("2026-02-01T00:00:00Z"),
    });

    const [first] = await loadDocumentsPerType(prisma, repoId, workspaceId, { perType: 1 });

    expect(first?.id).toBe(newest.id);
  });

  it("keeps one row per code-doc path instead of one per type", async () => {
    const { repoId, workspaceId } = await seedRepo("docs_per_type_code_docs");
    const analysis = await seedAnalysis(repoId, "sha-code", new Date("2026-01-01T00:00:00Z"));
    await seedDocument({ analysisId: analysis.id, path: "src/a.ts", repoId, type: "CODE_DOC" });
    await seedDocument({ analysisId: analysis.id, path: "src/b.ts", repoId, type: "CODE_DOC" });

    const docs = await loadDocumentsPerType(prisma, repoId, workspaceId, { perType: 1 });

    expect(
      docs
        .map((doc) => doc.path)
        .toSorted((left, right) => (left ?? "").localeCompare(right ?? "")),
    ).toStrictEqual(["src/a.ts", "src/b.ts"]);
  });

  it("scopes the window to one analysis when an aid is given", async () => {
    const { repoId, workspaceId } = await seedRepo("docs_per_type_scope");
    const older = await seedAnalysis(repoId, "sha-older", new Date("2026-01-01T00:00:00Z"));
    const latest = await seedAnalysis(repoId, "sha-latest", new Date("2026-02-01T00:00:00Z"));
    const olderDoc = await seedDocument({
      analysisId: older.id,
      repoId,
      type: "README",
      updatedAt: new Date("2026-03-01T00:00:00Z"),
    });
    const latestDoc = await seedDocument({
      analysisId: latest.id,
      repoId,
      type: "README",
      updatedAt: new Date("2026-02-01T00:00:00Z"),
    });

    const pinned = await loadDocumentsPerType(prisma, repoId, workspaceId, {
      aid: latest.id,
      perType: 1,
    });
    const unpinned = await loadDocumentsPerType(prisma, repoId, workspaceId, { perType: 1 });

    expect(pinned.map((doc) => doc.id)).toStrictEqual([latestDoc.id]);
    expect(unpinned.map((doc) => doc.id)).toStrictEqual([olderDoc.id]);
  });

  it("returns the decrypted content for the rows it selected", async () => {
    const { repoId, workspaceId } = await seedRepo("docs_per_type_content");
    const analysis = await seedAnalysis(repoId, "sha-content", new Date("2026-01-01T00:00:00Z"));
    await seedDocument({
      analysisId: analysis.id,
      content: "# secret readme\n\nBody copy.",
      repoId,
      type: "README",
    });

    const docs = await loadDocumentsPerType(prisma, repoId, workspaceId, {
      perType: 1,
      withContent: true,
    });

    expect(docs).toHaveLength(1);
    expect(docs[0]?.content).toBe("# secret readme\n\nBody copy.");
  });

  it("returns nothing for a repo without documents", async () => {
    const { repoId, workspaceId } = await seedRepo("docs_per_type_empty");

    await expect(
      loadDocumentsPerType(prisma, repoId, workspaceId, { perType: 1, withContent: true }),
    ).resolves.toStrictEqual([]);
  });

  it("stays inside the workspace even though raw SQL bypasses the policy layer", async () => {
    const first = await seedRepo("docs_per_type_isolation");
    const second = await seedRepo("docs_per_type_isolation_other");
    const analysis = await seedAnalysis(first.repoId, "sha-iso", new Date("2026-01-01T00:00:00Z"));
    await seedDocument({ analysisId: analysis.id, repoId: first.repoId, type: "README" });

    await expect(
      loadDocumentsPerType(prisma, first.repoId, second.workspaceId, { perType: 1 }),
    ).resolves.toStrictEqual([]);
  });
});
