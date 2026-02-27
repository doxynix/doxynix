import { describe, expect, it } from "vitest";

import { FileClassifier } from "@/server/utils/file-classifier";

describe("FileClassifier", () => {
  describe("isConfigFile", () => {
    it("should return true for known config paths in case-insensitive mode", () => {
      expect(FileClassifier.isConfigFile("PROJECT/TSCONFIG.JSON")).toBe(true);
      expect(FileClassifier.isConfigFile(".env.local")).toBe(true);
    });

    it("should return false for regular source files", () => {
      expect(FileClassifier.isConfigFile("src/features/repo/ui/repo-list.tsx")).toBe(false);
    });
  });

  describe("isApiFile", () => {
    it("should return true for API-like files", () => {
      expect(FileClassifier.isApiFile("src/server/trpc/router/repo.router.ts")).toBe(true);
      expect(FileClassifier.isApiFile("src/app/api/auth/route.ts")).toBe(true);
    });

    it("should return false for test files even if api keywords are present", () => {
      expect(FileClassifier.isApiFile("src/server/router/route.test.ts")).toBe(false);
    });
  });

  describe("isIgnored", () => {
    it("should detect ignored assets and directories", () => {
      expect(FileClassifier.isIgnored("node_modules/pkg/index.js")).toBe(true);
      expect(FileClassifier.isIgnored("public/logo.PNG")).toBe(true);
    });

    it("should return false for non-ignored source path", () => {
      expect(FileClassifier.isIgnored("src/server/utils/metrics.ts")).toBe(false);
    });
  });

  describe("isTestFile", () => {
    it("should detect tests by suffix and directory markers", () => {
      expect(FileClassifier.isTestFile("src/tests/unit/repo.service.test.ts")).toBe(true);
      expect(FileClassifier.isTestFile("src/server/__tests__/repo.ts")).toBe(true);
    });

    it("should return false for non-test file", () => {
      expect(FileClassifier.isTestFile("src/shared/lib/utils.ts")).toBe(false);
    });
  });

  describe("getScore", () => {
    it("should prioritize config files with highest score", () => {
      expect(FileClassifier.getScore("package.json")).toBe(100);
    });

    it("should prioritize api score over generic UI/default score", () => {
      expect(FileClassifier.getScore("src/server/repo/controller.ts")).toBe(90);
    });

    it("should return lower score for tests", () => {
      expect(FileClassifier.getScore("src/tests/integration/repo.spec.ts")).toBe(20);
    });

    it("should return UI score for component folders", () => {
      expect(FileClassifier.getScore("src/features/repo/components/list.tsx")).toBe(40);
      expect(FileClassifier.getScore("src/features/repo/ui/list.tsx")).toBe(40);
    });

    it("should return default score for regular source files", () => {
      expect(FileClassifier.getScore("src/server/utils/metrics.ts")).toBe(50);
    });
  });
});
