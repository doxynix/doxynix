import { DocType } from "@doxynix/shared";
import { describe, expect, it } from "vitest";

import {
  intentToAnalyzeHref,
  intentToDocTypes,
  intentToResultsPath,
  parseOnboardingIntent,
} from "./onboarding-intent";

describe("parseOnboardingIntent", () => {
  it("parses the lowercase URL form", () => {
    expect(parseOnboardingIntent("architecture")).toBe("ARCHITECTURE");
    expect(parseOnboardingIntent("documentation")).toBe("DOCUMENTATION");
    expect(parseOnboardingIntent("risks")).toBe("RISKS");
  });

  it("accepts the first value of an array", () => {
    expect(parseOnboardingIntent(["documentation", "risks"])).toBe("DOCUMENTATION");
  });

  it("returns null for missing or unknown values", () => {
    expect(parseOnboardingIntent(undefined)).toBeNull();
    expect(parseOnboardingIntent("")).toBeNull();
    expect(parseOnboardingIntent("nope")).toBeNull();
  });
});

describe("intentToDocTypes", () => {
  it("maps architecture to architecture docs", () => {
    expect(intentToDocTypes("ARCHITECTURE")).toEqual([DocType.ARCHITECTURE]);
  });

  it("maps documentation to README and API docs", () => {
    expect(intentToDocTypes("DOCUMENTATION")).toEqual([DocType.README, DocType.API]);
  });

  it("maps risk to architecture docs", () => {
    expect(intentToDocTypes("RISKS")).toEqual([DocType.ARCHITECTURE]);
  });

  it("falls back to README when intent is missing", () => {
    expect(intentToDocTypes(null)).toEqual([DocType.README]);
  });
});

describe("intentToResultsPath", () => {
  it("returns the architecture map for architecture", () => {
    expect(intentToResultsPath("ARCHITECTURE", "acme", "api")).toBe("/dashboard/repo/acme/api/map");
  });

  it("returns docs for documentation", () => {
    expect(intentToResultsPath("DOCUMENTATION", "acme", "api")).toBe(
      "/dashboard/repo/acme/api/docs",
    );
  });

  it("returns the overview for risks", () => {
    expect(intentToResultsPath("RISKS", "acme", "api")).toBe("/dashboard/repo/acme/api");
  });

  it("returns null when intent is missing", () => {
    expect(intentToResultsPath(null, "acme", "api")).toBeNull();
  });
});

describe("intentToAnalyzeHref", () => {
  it("keeps onboarding context in the URL", () => {
    expect(intentToAnalyzeHref("ARCHITECTURE", "acme", "api")).toBe(
      "/dashboard/repo/acme/api/analyze?onboarding=1&intent=architecture",
    );
  });
});
