import { describe, expect, it } from "vitest";

import { ProjectPolicy } from "./project-policy";

describe("ProjectPolicy", () => {
  it("classifies sensitive files and envs", () => {
    expect(ProjectPolicy.isSensitive(".env")).toBe(true);
    expect(ProjectPolicy.isSensitive(".env.production")).toBe(true);
    expect(ProjectPolicy.isSensitive(".env.example")).toBe(false);
  });

  it("identifies low-signal config and lockfiles", () => {
    expect(ProjectPolicy.isLowSignalConfig("bun.lock")).toBe(true);
    expect(ProjectPolicy.isLowSignalConfig("package-lock.json")).toBe(true);
    expect(ProjectPolicy.isLowSignalConfig("tsconfig.json")).toBe(false);
  });

  it("identifies entrypoints vs secondary files", () => {
    expect(ProjectPolicy.isPrimaryEntrypoint("src/main.ts")).toBe(true);
    expect(ProjectPolicy.isPrimaryEntrypoint("scripts/seed.ts")).toBe(false);
  });

  it("derives correct group IDs for monorepo paths", () => {
    expect(ProjectPolicy.deriveGroupId("src/modules/auth/service.ts")).toBe("src/modules/auth");
    expect(ProjectPolicy.deriveGroupId("packages/shared/src/index.ts")).toBe("packages/shared");
  });
});
