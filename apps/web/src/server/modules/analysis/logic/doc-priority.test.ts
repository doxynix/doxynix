import { DocType } from "@doxynix/shared";
import { describe, expect, it } from "vitest";

import {
  ALL_DOC_TYPES,
  calculateDocumentationOutputScore,
  DOC_SECTION_DEPENDENCIES,
} from "./doc-priority";

describe("ALL_DOC_TYPES / DOC_SECTION_DEPENDENCIES", () => {
  it("lists documentable types in priority order", () => {
    expect(ALL_DOC_TYPES).toEqual([
      DocType.README,
      DocType.API,
      DocType.ARCHITECTURE,
      DocType.CONTRIBUTING,
      DocType.CHANGELOG,
    ]);
  });

  it("describes section dependencies for each document type", () => {
    expect(DOC_SECTION_DEPENDENCIES[DocType.API]).toEqual(["api_reference"]);
    expect(DOC_SECTION_DEPENDENCIES[DocType.ARCHITECTURE]).toEqual([
      "architecture",
      "risks",
      "onboarding",
    ]);
    expect(DOC_SECTION_DEPENDENCIES[DocType.README]).toEqual(["overview", "architecture"]);
    expect(DOC_SECTION_DEPENDENCIES[DocType.CHANGELOG]).toEqual([]);
  });
});

describe("calculateDocumentationOutputScore", () => {
  it("empty input yields zero score and an empty snapshot", () => {
    const result = calculateDocumentationOutputScore({});

    expect(result.score).toBe(0);
    expect(result.generatedCount).toBe(0);
    expect(result.totalCount).toBe(5);
    expect(result.snapshot).toEqual({
      api: false,
      architecture: false,
      changelog: false,
      contributing: false,
      readme: false,
    });
  });

  it("a full documentation set scores 100 points", () => {
    const result = calculateDocumentationOutputScore({
      generatedApiMarkdown: "# API",
      generatedArchitecture: "# Architecture",
      generatedChangelog: "# Changelog",
      generatedContributing: "# Contributing",
      generatedReadme: "# Readme",
    });

    expect(result.score).toBe(100);
    expect(result.generatedCount).toBe(5);
    expect(result.snapshot).toEqual({
      api: true,
      architecture: true,
      changelog: true,
      contributing: true,
      readme: true,
    });
  });

  it("weights readme (30) and api (25) above the rest", () => {
    const result = calculateDocumentationOutputScore({
      generatedApiMarkdown: "# API",
      generatedReadme: "# Readme",
    });

    expect(result.score).toBe(55);
    expect(result.generatedCount).toBe(2);
    expect(result.snapshot.api).toBe(true);
    expect(result.snapshot.readme).toBe(true);
    expect(result.snapshot.architecture).toBe(false);
  });

  it("ignores empty strings and whitespace (hasText)", () => {
    const result = calculateDocumentationOutputScore({
      generatedContributing: "   ",
      generatedReadme: "",
    });

    expect(result.score).toBe(0);
    expect(result.generatedCount).toBe(0);
    expect(result.snapshot.readme).toBe(false);
  });

  it("swaggerYaml does not count toward the documentation completeness score", () => {
    const result = calculateDocumentationOutputScore({ swaggerYaml: "openapi: 3.0.0" });

    expect(result.score).toBe(0);
    expect(result.generatedCount).toBe(0);
  });
});
