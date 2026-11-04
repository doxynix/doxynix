import { describe, expect, it } from "vitest";

import { buildDocsChatSystemPrompt } from "./docs-chat.prompt";

const PAGES = [
  { description: "Run your first analysis", title: "Quickstart", url: "/docs/getting-started" },
  { description: "Every dxnx command", title: "CLI reference", url: "/docs/cli/reference" },
];

describe("buildDocsChatSystemPrompt", () => {
  it("lists every documentation page with its url and description", () => {
    const prompt = buildDocsChatSystemPrompt(PAGES);

    expect(prompt).toContain("- /docs/getting-started — Quickstart: Run your first analysis");
    expect(prompt).toContain("- /docs/cli/reference — CLI reference: Every dxnx command");
  });

  it("tells the model to search and cite the docs", () => {
    const prompt = buildDocsChatSystemPrompt(PAGES);

    expect(prompt).toContain('Call the "search" tool');
    expect(prompt).toContain("[Quickstart](/docs/getting-started)");
  });

  it("does not leak unresolved values", () => {
    const prompt = buildDocsChatSystemPrompt(PAGES);

    expect(prompt).not.toContain("undefined");
  });

  it("renders pages without a description", () => {
    const prompt = buildDocsChatSystemPrompt([{ title: "Plans", url: "/docs/account/plans" }]);

    expect(prompt).toContain("- /docs/account/plans — Plans");
  });
});
