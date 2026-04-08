import { describe, expect, it } from "vitest";

import { getFileScore } from "@/server/shared/engine/core/file-classifier";
import { ProjectPolicy } from "@/server/shared/engine/core/project-policy";

describe("FileClassifier", () => {
  describe("isConfigFile", () => {
    it("should return true for known config paths in case-insensitive mode", () => {
      expect(ProjectPolicy.isConfigFile("PROJECT/TSCONFIG.JSON")).toBe(true);
      expect(ProjectPolicy.isConfigFile(".env.local")).toBe(false);
    });

    it("should return false for regular source files", () => {
      expect(ProjectPolicy.isConfigFile("src/features/repo/ui/repo-list.tsx")).toBe(false);
    });
  });

  describe("isApiFile", () => {
    it("should return true for API-like files", () => {
      expect(ProjectPolicy.isApiPath("src/server/trpc/router/repo.router.ts")).toBe(true);
      expect(ProjectPolicy.isApiPath("src/app/api/auth/route.ts")).toBe(true);
    });

    it("should return false for test files even if api keywords are present", () => {
      expect(ProjectPolicy.isApiPath("src/server/router/route.test.ts")).toBe(false);
    });
  });

  describe("isIgnored", () => {
    it("should detect ignored assets and directories", () => {
      expect(ProjectPolicy.isIgnored("node_modules/pkg/index.js")).toBe(true);
      expect(ProjectPolicy.isIgnored("public/logo.PNG")).toBe(true);
    });

    it("should return false for non-ignored source path", () => {
      expect(ProjectPolicy.isIgnored("src/server/utils/metrics.ts")).toBe(false);
    });
  });

  describe("isTestFile", () => {
    it("should detect tests by suffix and directory markers", () => {
      expect(ProjectPolicy.isTestFile("src/tests/unit/repo.service.test.ts")).toBe(true);
      expect(ProjectPolicy.isTestFile("src/server/__tests__/repo.ts")).toBe(true);
    });

    it("should return false for non-test file", () => {
      expect(ProjectPolicy.isTestFile("src/shared/lib/utils.ts")).toBe(false);
    });
  });

  describe("getScore", () => {
    it("should prioritize config files with highest score", () => {
      expect(getFileScore("package.json")).toBe(85);
    });

    it("should prioritize api score over generic UI/default score", () => {
      expect(getFileScore("src/server/repo/controller.ts")).toBe(80);
    });

    it("should return lower score for tests", () => {
      expect(getFileScore("src/tests/integration/repo.spec.ts")).toBe(20);
    });

    it("should return UI score for component folders", () => {
      expect(getFileScore("src/features/repo/components/list.tsx")).toBe(60);
      expect(getFileScore("src/features/repo/ui/list.tsx")).toBe(60);
    });

    it("should return default score for regular source files", () => {
      expect(getFileScore("src/server/utils/metrics.ts")).toBe(80);
    });
  });
});
