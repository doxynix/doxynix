import { describe, expect, it } from "vitest";

import type { MatchableDoc } from "./doc-section-matcher";
import { buildDocSearchTerms, matchDocSections } from "./doc-section-matcher";

function doc(overrides: Partial<MatchableDoc> & { content: string }): MatchableDoc {
  return {
    publicId: "doc-1",
    type: "ARCHITECTURE",
    version: "sha1",
    ...overrides,
  };
}

describe("buildDocSearchTerms", () => {
  it("contributes the lowercased basename and full path for each file", () => {
    expect(buildDocSearchTerms(["src/Server/App.ts"])).toEqual(["app.ts", "src/server/app.ts"]);
  });

  it("returns an empty list for no files", () => {
    expect(buildDocSearchTerms([])).toEqual([]);
  });

  it("keeps duplicates so a repeated path stays matchable", () => {
    expect(buildDocSearchTerms(["a/b.ts", "a/b.ts"])).toHaveLength(4);
  });
});

describe("matchDocSections", () => {
  it("returns nothing when no section matches", () => {
    const result = matchDocSections({
      docs: [doc({ content: "# Payments\n\nUnrelated prose." })],
      graph: null,
      nodeId: "group:core",
      nodeLabel: "Core",
      relatedFiles: [],
    });

    expect(result).toEqual([]);
  });

  it("matches a section by the node label appearing in its title", () => {
    const result = matchDocSections({
      docs: [doc({ content: "# Core Services\n\nBody." })],
      graph: null,
      nodeId: "group:core",
      nodeLabel: "Core Services",
      relatedFiles: [],
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.title).toBe("Core Services");
  });

  it("matches a section by a related file basename in the title", () => {
    const result = matchDocSections({
      docs: [doc({ content: "# Overview of billing.ts\n\nBody." })],
      graph: null,
      nodeId: "group:x",
      nodeLabel: "Nothing Alike",
      relatedFiles: ["src/billing.ts"],
    });

    expect(result).toHaveLength(1);
  });

  it("matches a section by a related file path mentioned only in the body", () => {
    const result = matchDocSections({
      docs: [doc({ content: "# Notes\n\nSee src/billing.ts for details." })],
      graph: null,
      nodeId: "group:x",
      nodeLabel: "Nothing Alike",
      relatedFiles: ["src/billing.ts"],
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.title).toBe("Notes");
  });

  it("is case insensitive on both label and file terms", () => {
    const result = matchDocSections({
      docs: [doc({ content: "# CORE SERVICES\n\nBody." })],
      graph: null,
      nodeId: "group:core",
      nodeLabel: "core services",
      relatedFiles: [],
    });

    expect(result).toHaveLength(1);
  });

  it("carries the owning document id and type onto each match", () => {
    const result = matchDocSections({
      docs: [doc({ content: "# Core\n\nBody.", publicId: "doc-42", type: "README" })],
      graph: null,
      nodeId: "group:core",
      nodeLabel: "Core",
      relatedFiles: [],
    });

    expect(result[0]).toMatchObject({ docId: "doc-42", docType: "README" });
    expect(result[0]?.id).toBeTruthy();
  });

  it("caps matches per document", () => {
    const content = ["# Core", ...Array.from({ length: 10 }, (_, i) => `## Core ${i}`)].join(
      "\n\n",
    );
    const result = matchDocSections({
      docs: [doc({ content })],
      graph: null,
      nodeId: "group:core",
      nodeLabel: "Core",
      perDocLimit: 3,
      relatedFiles: [],
    });

    expect(result).toHaveLength(3);
  });

  it("caps matches across documents", () => {
    const result = matchDocSections({
      docs: [
        doc({ content: "# Core A\n\nx", publicId: "d1" }),
        doc({ content: "# Core B\n\nx", publicId: "d2" }),
        doc({ content: "# Core C\n\nx", publicId: "d3" }),
      ],
      graph: null,
      nodeId: "group:core",
      nodeLabel: "Core",
      relatedFiles: [],
      totalLimit: 2,
    });

    expect(result).toHaveLength(2);
    expect(result.map((r) => r.docId)).toEqual(["d1", "d2"]);
  });

  it("defaults to at most four sections per document and eight overall", () => {
    const perDoc = Array.from({ length: 6 }, (_, i) => `# Core ${i}\n\nx`).join("\n\n");
    const result = matchDocSections({
      docs: [doc({ content: perDoc, publicId: "d1" }), doc({ content: perDoc, publicId: "d2" })],
      graph: null,
      nodeId: "group:core",
      nodeLabel: "Core",
      relatedFiles: [],
    });

    // 4 from d1 + 4 from d2, truncated to the overall cap of 8.
    expect(result).toHaveLength(8);
  });

  it("returns nothing for an empty document list", () => {
    expect(
      matchDocSections({
        docs: [],
        graph: null,
        nodeId: "group:core",
        nodeLabel: "Core",
        relatedFiles: ["a.ts"],
      }),
    ).toEqual([]);
  });
});
