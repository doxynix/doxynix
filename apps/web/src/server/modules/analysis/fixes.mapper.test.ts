import { describe, expect, it } from "vitest";

import { SKIP_FIELDS } from "@/server/utils/sanitize-payload";

import { GeneratedFixDetailedDTO, GeneratedFixDTO } from "./analysis.schemas";
import {
  fixesMapper,
  type GeneratedFixRecord,
  type GeneratedFixSummaryRecord,
} from "./fixes.mapper";

const PUBLIC_ALLOWLIST = [
  "branch",
  "createdAt",
  "description",
  "estimatedImpact",
  "githubPrNumber",
  "githubPrUrl",
  "id",
  "status",
  "title",
];

const DETAILED_ALLOWLIST = [...PUBLIC_ALLOWLIST, "resultJson"].sort();

const INTERNAL_ONLY = [...SKIP_FIELDS].filter((field) => field !== "id");

const PUBLIC_ID_KEYS = ["id"];

const PR_ANALYSIS_ID = "0195a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5e";
const REPO_ID = "0195a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5f";

function makeFix(overrides: Partial<GeneratedFixRecord> = {}): GeneratedFixRecord {
  return {
    branch: "dxnx/fix-1",
    createdAt: new Date("2026-01-01T00:00:00Z"),
    createdByUser: true,
    description: null,
    estimatedImpact: null,
    githubPrNumber: null,
    githubPrUrl: null,
    id: "018f0000-0000-7000-8000-000000000001",
    prAnalysisId: null,
    repoId: "018f0000-0000-7000-8000-000000000009",
    status: "DRAFT",
    title: "AI Suggested Improvements",
    updatedAt: new Date("2026-01-02T00:00:00Z"),
    ...overrides,
  };
}

function makeSummaryFix(
  overrides: Partial<GeneratedFixSummaryRecord> = {},
): GeneratedFixSummaryRecord {
  return {
    githubPrNumber: null,
    githubPrUrl: null,
    id: "018f0000-0000-7000-8000-000000000002",
    status: "PR_OPENED",
    title: "Fix the thing",
    ...overrides,
  };
}

describe("fixesMapper", () => {
  describe("toPublic", () => {
    it("maps the primary key to id and exposes only DTO fields", () => {
      const result = fixesMapper.toPublic(makeFix());

      expect(result).toStrictEqual({
        branch: "dxnx/fix-1",
        createdAt: new Date("2026-01-01T00:00:00Z"),
        description: null,
        estimatedImpact: null,
        githubPrNumber: null,
        githubPrUrl: null,
        id: "018f0000-0000-7000-8000-000000000001",
        status: "DRAFT",
        title: "AI Suggested Improvements",
      });
    });

    it("never leaks the internal numeric id or internal columns", () => {
      const row = makeFix({
        description: "desc",
        estimatedImpact: 88,
        githubPrNumber: 1234,
        githubPrUrl: "https://github.com/o/r/pull/1234",
        prAnalysisId: PR_ANALYSIS_ID,
        status: "PR_OPENED",
      });

      expect(Object.keys(fixesMapper.toPublic(row)).sort()).toStrictEqual(
        Object.keys(GeneratedFixDTO.shape).sort(),
      );
    });

    it("survives the DTO output schema unchanged", () => {
      const row = makeFix({ githubPrNumber: null, githubPrUrl: null, title: "" });
      const result = GeneratedFixDTO.parse(fixesMapper.toPublic(row));

      expect(result.id).toBe(row.id);
      expect(result.title).toBe("");
      expect(GeneratedFixDTO.safeParse(result).success).toBe(true);
    });

    it("emits exactly the allowlisted keys and nothing else", () => {
      expect(Object.keys(fixesMapper.toPublic(makeFix())).sort()).toStrictEqual(PUBLIC_ALLOWLIST);
    });

    it("drops createdByUser and updatedAt, which the DTO has no slot for", () => {
      const row = makeFix();
      const result = fixesMapper.toPublic(row) as Record<string, unknown>;

      expect(row.createdByUser).toBe(true);
      expect(row.updatedAt).toBeInstanceOf(Date);
      expect(Object.hasOwn(result, "createdByUser")).toBe(false);
      expect(Object.hasOwn(result, "updatedAt")).toBe(false);
      expect(Object.hasOwn(GeneratedFixDTO.shape, "createdByUser")).toBe(false);
      expect(Object.hasOwn(GeneratedFixDTO.shape, "updatedAt")).toBe(false);
    });

    it("leaks no internal Prisma column", () => {
      const row = makeFix({ prAnalysisId: PR_ANALYSIS_ID, repoId: REPO_ID });
      const result = fixesMapper.toPublic(row) as Record<string, unknown>;

      for (const field of INTERNAL_ONLY) {
        expect(Object.hasOwn(result, field)).toBe(false);
      }
      for (const key of PUBLIC_ID_KEYS) {
        expect(result[key]).toBe(row.id);
      }
    });
  });

  describe("toDetailed", () => {
    it("adds the parsed result payload on top of the public shape", () => {
      const result = fixesMapper.toDetailed(makeFix(), {
        fixedFiles: [{ filePath: "a.ts", newContent: "x" }],
      });

      expect(result.resultJson).toStrictEqual({
        fixedFiles: [{ filePath: "a.ts", newContent: "x" }],
      });
      expect(Object.keys(result).sort()).toStrictEqual(
        Object.keys(GeneratedFixDetailedDTO.shape).sort(),
      );
    });

    it("emits a null result payload when nothing was cached", () => {
      expect(fixesMapper.toDetailed(makeFix(), null).resultJson).toBeNull();
      expect(
        GeneratedFixDetailedDTO.safeParse(fixesMapper.toDetailed(makeFix(), null)).success,
      ).toBe(true);
    });

    it("adds resultJson and nothing else to the public allowlist", () => {
      expect(Object.keys(fixesMapper.toDetailed(makeFix(), null)).sort()).toStrictEqual(
        DETAILED_ALLOWLIST,
      );
    });

    it("also omits createdByUser and updatedAt, not just toPublic", () => {
      const result = fixesMapper.toDetailed(makeFix(), null) as Record<string, unknown>;

      expect(Object.hasOwn(result, "createdByUser")).toBe(false);
      expect(Object.hasOwn(result, "updatedAt")).toBe(false);
    });

    it("leaks no internal Prisma column on the detailed shape either", () => {
      const result = fixesMapper.toDetailed(
        makeFix({ prAnalysisId: PR_ANALYSIS_ID, repoId: REPO_ID }),
        null,
      ) as Record<string, unknown>;

      for (const field of INTERNAL_ONLY) {
        expect(Object.hasOwn(result, field)).toBe(false);
      }
      expect(result.id).toBe(makeFix().id);
    });
  });

  describe("toSummary", () => {
    it("projects only the fields the node inspector renders", () => {
      const result = fixesMapper.toSummary(makeSummaryFix());

      expect(result).toStrictEqual({
        githubPrNumber: null,
        githubPrUrl: null,
        id: "018f0000-0000-7000-8000-000000000002",
        status: "PR_OPENED",
        title: "Fix the thing",
      });
    });

    it("keeps a populated PR pointer", () => {
      expect(
        fixesMapper.toSummary(
          makeSummaryFix({
            githubPrNumber: 55,
            githubPrUrl: "https://github.com/o/r/pull/55",
          }),
        ),
      ).toStrictEqual({
        githubPrNumber: 55,
        githubPrUrl: "https://github.com/o/r/pull/55",
        id: "018f0000-0000-7000-8000-000000000002",
        status: "PR_OPENED",
        title: "Fix the thing",
      });
    });

    it("leaks no internal Prisma column either", () => {
      const result = fixesMapper.toSummary(makeSummaryFix()) as Record<string, unknown>;

      for (const field of INTERNAL_ONLY) {
        expect(Object.hasOwn(result, field)).toBe(false);
      }
    });
  });
});
