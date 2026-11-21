import type { LanguageSupport } from "@codemirror/language";
import { languages } from "@codemirror/language-data";
import { describe, expect, it } from "vitest";

import { diagnosticsFromTree } from "./editor-extensions";

async function supportForJavaScript(): Promise<LanguageSupport> {
  const descriptor = languages.find((language) => language.name === "JavaScript");
  if (descriptor == null) {
    throw new Error("JavaScript language descriptor is missing");
  }

  return descriptor.load();
}

describe("diagnosticsFromTree", () => {
  it("reports nothing for valid JavaScript", async () => {
    const support = await supportForJavaScript();
    const tree = support.language.parser.parse("const value = 1;\n");

    expect(diagnosticsFromTree(tree, "syntax")).toEqual([]);
  });

  it("reports an error node for incomplete JavaScript", async () => {
    const support = await supportForJavaScript();
    const tree = support.language.parser.parse("const value = ;\n");

    expect(diagnosticsFromTree(tree, "syntax").length).toBeGreaterThan(0);
  });
});
