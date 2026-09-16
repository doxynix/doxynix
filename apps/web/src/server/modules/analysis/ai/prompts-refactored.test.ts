import { describe, expect, it } from "vitest";

import {
  buildAnalysisSystemPrompt,
  buildAnalysisUserPrompt,
  buildApiWriterSystemPrompt,
  buildApiWriterUserPrompt,
  buildArchitectureWriterSystemPrompt,
  buildArchitectureWriterUserPrompt,
  buildChangelogWriterSystemPrompt,
  buildChangelogWriterUserPrompt,
  buildCodeDocSystemPrompt,
  buildCodeDocUserPrompt,
  buildCodeFixerSystemPrompt,
  buildCodeFixerUserPrompt,
  buildContributingWriterSystemPrompt,
  buildContributingWriterUserPrompt,
  buildMapperSystemPrompt,
  buildMapperUserPrompt,
  buildPrReviewSystemPrompt,
  buildPrReviewUserPrompt,
  buildReadmeWriterSystemPrompt,
  buildReadmeWriterUserPrompt,
  buildSentinelSystemPrompt,
  buildSentinelUserPrompt,
  buildSingleFileAnalysisPrompt,
} from "./prompts-refactored";

// ---------------------------------------------------------------------------
// Sentinel
// ---------------------------------------------------------------------------
describe("buildSentinelSystemPrompt", () => {
  it("returns non-empty string with security sentinel markers", () => {
    const out = buildSentinelSystemPrompt();
    expect(out.length).toBeGreaterThan(50);
    expect(out).toContain("Offensive Security Engineer");
    expect(out).toContain("UNSAFE TRIGGERS");
    expect(out).toContain("SAFE TRIGGERS");
  });
});

describe("buildSentinelUserPrompt", () => {
  it("interpolates the instructions string", () => {
    const out = buildSentinelUserPrompt("review this code");
    expect(out).toContain("INPUT_TO_ANALYZE");
    expect(out).toContain("review this code");
    expect(out.length).toBeGreaterThan(10);
  });
});

// ---------------------------------------------------------------------------
// Mapper
// ---------------------------------------------------------------------------
describe("buildMapperSystemPrompt", () => {
  it("returns prompt with architect role and mapping instructions", () => {
    const out = buildMapperSystemPrompt();
    expect(out.length).toBeGreaterThan(50);
    expect(out).toContain("Systems Architect");
    expect(out).toContain("Architectural Blueprint");
    expect(out).toContain("mermaid_graph");
    expect(out).toContain("complexity_index");
  });
});

describe("buildMapperUserPrompt", () => {
  it("embeds skeleton JSON", () => {
    const skeleton = '{"files":["a.ts"]}';
    const out = buildMapperUserPrompt(skeleton);
    expect(out).toContain("STRUCTURED_REPOSITORY_SKELETON");
    expect(out).toContain(skeleton);
    expect(out.length).toBeGreaterThan(20);
  });
});

// ---------------------------------------------------------------------------
// Analysis
// ---------------------------------------------------------------------------
describe("buildAnalysisSystemPrompt", () => {
  it("defaults to English role", () => {
    const out = buildAnalysisSystemPrompt();
    expect(out).toContain("Static Code Auditor");
    expect(out).toContain("aiSchema");
    expect(out).toContain("English");
    expect(out.length).toBeGreaterThan(50);
  });

  it("supports custom target language", () => {
    const out = buildAnalysisSystemPrompt("Russian");
    expect(out).toContain("Russian");
    expect(out.length).toBeGreaterThan(50);
  });
});

describe("buildAnalysisUserPrompt", () => {
  it("embeds all 4 positional arguments", () => {
    const digest = '{"modules":[]}';
    const snippets = "<code>app()</code>";
    const instructions = "focus on auth";
    const sentinelStatus = "SAFE" as const;

    const out = buildAnalysisUserPrompt(digest, snippets, instructions, sentinelStatus);
    expect(out).toContain(digest);
    expect(out).toContain(snippets);
    expect(out).toContain(instructions);
    expect(out).toContain(sentinelStatus);
    expect(out.length).toBeGreaterThan(50);
  });
});

// ---------------------------------------------------------------------------
// API Writer
// ---------------------------------------------------------------------------
describe("buildApiWriterSystemPrompt", () => {
  it("includes api-documentarian role and OpenAPI reference", () => {
    const out = buildApiWriterSystemPrompt();
    expect(out).toContain("Principal API Architect");
    expect(out).toContain("OpenAPI");
    expect(out.length).toBeGreaterThan(50);
  });

  it("respects custom language", () => {
    const out = buildApiWriterSystemPrompt("Japanese");
    expect(out).toContain("Japanese");
    expect(out.length).toBeGreaterThan(50);
  });
});

describe("buildApiWriterUserPrompt", () => {
  it("embeds all 4 inputs", () => {
    const out = buildApiWriterUserPrompt("api-ref", "dossier", "ctx", '["src"]');
    expect(out).toContain("api-ref");
    expect(out).toContain("dossier");
    expect(out).toContain("ctx");
    expect(out).toContain('["src"]');
    expect(out.length).toBeGreaterThan(20);
  });
});

// ---------------------------------------------------------------------------
// Readme Writer
// ---------------------------------------------------------------------------
describe("buildReadmeWriterSystemPrompt", () => {
  it("includes readme-writer role", () => {
    const out = buildReadmeWriterSystemPrompt();
    expect(out).toContain("Developer Relations Engineer");
    expect(out).toContain("Onboarding");
    expect(out.length).toBeGreaterThan(50);
  });
});

describe("buildReadmeWriterUserPrompt", () => {
  it("embeds all 4 inputs", () => {
    const out = buildReadmeWriterUserPrompt("readme-sect", "dossier", "support", "paths");
    expect(out).toContain("readme-sect");
    expect(out).toContain("dossier");
    expect(out).toContain("support");
    expect(out).toContain("paths");
    expect(out.length).toBeGreaterThan(20);
  });
});

// ---------------------------------------------------------------------------
// Contributing Writer
// ---------------------------------------------------------------------------
describe("buildContributingWriterSystemPrompt", () => {
  it("includes contributing-writer role", () => {
    const out = buildContributingWriterSystemPrompt();
    expect(out).toContain("Open Source Maintainer");
    expect(out).toContain("Development Guide");
    expect(out.length).toBeGreaterThan(50);
  });
});

describe("buildContributingWriterUserPrompt", () => {
  it("embeds all 4 inputs", () => {
    const out = buildContributingWriterUserPrompt(
      '{"findings":[]}',
      "dossier",
      "configFiles",
      "paths",
    );
    expect(out).toContain("dossier");
    expect(out).toContain("configFiles");
    expect(out).toContain("paths");
    expect(out.length).toBeGreaterThan(20);
  });
});

// ---------------------------------------------------------------------------
// Changelog Writer
// ---------------------------------------------------------------------------
describe("buildChangelogWriterSystemPrompt", () => {
  it("includes changelog-writer role", () => {
    const out = buildChangelogWriterSystemPrompt();
    expect(out).toContain("Release Manager");
    expect(out).toContain("Keep a Changelog");
    expect(out.length).toBeGreaterThan(50);
  });
});

describe("buildChangelogWriterUserPrompt", () => {
  it("embeds all 3 param fields", () => {
    const out = buildChangelogWriterUserPrompt({
      analysisDeltaJson: '{"complexity":5}',
      commitsJson: "- a: fix bug",
      pullRequestsJson: "- PR-1",
    });
    expect(out).toContain('{"complexity":5}');
    expect(out).toContain("- a: fix bug");
    expect(out).toContain("- PR-1");
    expect(out.length).toBeGreaterThan(30);
  });
});

// ---------------------------------------------------------------------------
// Code Doc
// ---------------------------------------------------------------------------
describe("buildCodeDocSystemPrompt", () => {
  it("includes code-documenter role", () => {
    const out = buildCodeDocSystemPrompt();
    expect(out).toContain("Technical Documentation Engineer");
    expect(out).toContain("Search-and-Replace");
    expect(out.length).toBeGreaterThan(50);
  });
});

describe("buildCodeDocUserPrompt", () => {
  it("embeds file path and content", () => {
    const out = buildCodeDocUserPrompt("src/index.ts", "function foo() {}");
    expect(out).toContain("src/index.ts");
    expect(out).toContain("function foo() {}");
    expect(out.length).toBeGreaterThan(20);
  });
});

// ---------------------------------------------------------------------------
// Architecture Writer
// ---------------------------------------------------------------------------
describe("buildArchitectureWriterSystemPrompt", () => {
  it("includes architecture-writer role", () => {
    const out = buildArchitectureWriterSystemPrompt();
    expect(out).toContain("Staff Technical Writer");
    expect(out).toContain("ADRs");
    expect(out.length).toBeGreaterThan(50);
  });
});

describe("buildArchitectureWriterUserPrompt", () => {
  it("embeds all 7 positional args", () => {
    const out = buildArchitectureWriterUserPrompt(
      "arch-json",
      "risks-json",
      "onboard-json",
      "module-dep-json",
      "dossier-json",
      "ctx-str",
      "allowed-paths",
    );
    expect(out).toContain("arch-json");
    expect(out).toContain("risks-json");
    expect(out).toContain("onboard-json");
    expect(out).toContain("module-dep-json");
    expect(out).toContain("dossier-json");
    expect(out).toContain("ctx-str");
    expect(out).toContain("allowed-paths");
    expect(out.length).toBeGreaterThan(50);
  });
});

// ---------------------------------------------------------------------------
// Single File Analysis
// ---------------------------------------------------------------------------
describe("buildSingleFileAnalysisPrompt", () => {
  it("returns code-reviewer prompt with default language", () => {
    const out = buildSingleFileAnalysisPrompt();
    expect(out).toContain("Senior Peer Reviewer");
    expect(out).toContain("Code Review Report");
    expect(out).toContain("English");
    expect(out.length).toBeGreaterThan(50);
  });

  it("respects custom language", () => {
    const out = buildSingleFileAnalysisPrompt("German");
    expect(out).toContain("German");
    expect(out.length).toBeGreaterThan(50);
  });
});

// ---------------------------------------------------------------------------
// PR Review
// ---------------------------------------------------------------------------
describe("buildPrReviewSystemPrompt", () => {
  it("includes code-reviewer role and diff review instruction", () => {
    const out = buildPrReviewSystemPrompt();
    expect(out).toContain("Senior Peer Reviewer");
    expect(out).toContain("Pull Request Diff");
    expect(out.length).toBeGreaterThan(50);
  });
});

describe("buildPrReviewUserPrompt", () => {
  it("embeds diff and project overview", () => {
    const out = buildPrReviewUserPrompt({
      diffPayload: "+ added line",
      projectOverviewJson: '{"overview":"x"}',
    });
    expect(out).toContain("+ added line");
    expect(out).toContain('{"overview":"x"}');
    expect(out.length).toBeGreaterThan(20);
  });
});

// ---------------------------------------------------------------------------
// Code Fixer
// ---------------------------------------------------------------------------
describe("buildCodeFixerSystemPrompt", () => {
  it("includes SEARCH/REPLACE instruction", () => {
    const out = buildCodeFixerSystemPrompt();
    expect(out).toContain("SEARCH");
    expect(out).toContain("REPLACE");
    expect(out.length).toBeGreaterThan(50);
  });
});

describe("buildCodeFixerUserPrompt", () => {
  it("embeds findings and file contents", () => {
    const findings = [{ file: "a.ts", line: 5, suggestion: "fix me", type: "bug" }];
    const files = { "a.ts": "const x = 1;" };
    const out = buildCodeFixerUserPrompt(findings, files);
    expect(out).toContain("a.ts");
    expect(out).toContain("fix me");
    expect(out).toContain("const x = 1;");
    expect(out.length).toBeGreaterThan(30);
  });

  it("uses default suggestion when suggestion is missing", () => {
    const findings = [{ file: "b.ts", line: 1, type: "style" }];
    const out = buildCodeFixerUserPrompt(findings, { "b.ts": "code" });
    expect(out).toContain("b.ts");
    expect(out.length).toBeGreaterThan(10);
  });
});
