import { describe, expect, it } from "vitest";

import { buildLlmsFullTxt } from "./llms-full";

const BASE_URL = "https://doxynix.space";

describe("buildLlmsFullTxt", () => {
  it("should contain every required section", () => {
    const txt = buildLlmsFullTxt(BASE_URL);

    for (const heading of [
      "## What Doxynix is",
      "## How an analysis runs",
      "## Generated documents",
      "## Metrics",
      "## Plans and limits",
      "## CLI",
      "## API and MCP",
      "## Security and data handling",
      "## FAQ",
      "## Links",
    ]) {
      expect(txt, `missing section: ${heading}`).toContain(heading);
    }
  });

  it("should stay inside the context budget", () => {
    expect(buildLlmsFullTxt(BASE_URL).length).toBeLessThan(20_000);
  });

  it("should not contain unresolved placeholders", () => {
    const txt = buildLlmsFullTxt(BASE_URL);

    expect(txt).not.toMatch(/\$\{|\bTODO\b|\bTBD\b|\bFIXME\b/);
  });

  it("should build absolute urls", () => {
    const txt = buildLlmsFullTxt(BASE_URL);
    const urls = [...txt.matchAll(/\]\(([^)]+)\)/g)].map((match) => match[1] ?? "");

    expect(urls.length).toBeGreaterThan(3);

    for (const url of urls) {
      expect(url.startsWith("https://")).toBe(true);
    }
  });

  it("should not reference the base url as undefined", () => {
    expect(buildLlmsFullTxt(BASE_URL)).not.toContain("undefined");
  });
});
