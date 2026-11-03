import { describe, expect, it } from "vitest";

import { buildLlmsTxt, LLMS_SECTIONS } from "./llms";
import { PUBLIC_ROUTES } from "./public-routes";

const BASE_URL = "https://doxynix.space";

// `api/mcp` is an endpoint and `docs*` are fumadocs pages; none are in PUBLIC_ROUTES.
const KNOWN_INTERNAL_PATHS = new Set(["api/mcp", "docs", "docs/cli/reference"]);

function collectUrls(txt: string): string[] {
  return [...txt.matchAll(/\]\(([^)]+)\)/g)].map((match) => match[1] ?? "");
}

describe("buildLlmsTxt", () => {
  it("should start with the required H1 and blockquote summary", () => {
    const lines = buildLlmsTxt(BASE_URL).split("\n");

    expect(lines[0]).toBe("# Doxynix");
    expect(lines[1]).toBe("");
    expect(lines[2]?.startsWith("> ")).toBe(true);
  });

  it("should build absolute urls for every entry", () => {
    const urls = collectUrls(buildLlmsTxt(BASE_URL));

    expect(urls.length).toBeGreaterThan(5);

    for (const url of urls) {
      expect(url.startsWith("https://")).toBe(true);
    }
  });

  it("should reference only public site pages and known external hosts", () => {
    const knownPaths = new Set(PUBLIC_ROUTES.map((route) => route.path));

    for (const section of LLMS_SECTIONS) {
      for (const entry of section.entries) {
        if (entry.href.startsWith("http")) {
          continue;
        }

        const isKnown = knownPaths.has(entry.href) || KNOWN_INTERNAL_PATHS.has(entry.href);
        expect(isKnown, `unknown internal href: ${entry.href}`).toBe(true);
      }
    }
  });

  it("should link the docs pages and the GitHub Action", () => {
    const urls = collectUrls(buildLlmsTxt(BASE_URL));

    expect(urls).toContain("https://doxynix.space/docs");
    expect(urls).toContain("https://doxynix.space/docs/cli/reference");
    expect(urls).toContain("https://github.com/doxynix/action");
  });

  it("should not duplicate urls", () => {
    const urls = collectUrls(buildLlmsTxt(BASE_URL));

    expect(new Set(urls).size).toBe(urls.length);
  });

  it("should never link authenticated app routes", () => {
    const txt = buildLlmsTxt(BASE_URL);

    expect(txt).not.toContain("/dashboard");
    expect(txt).not.toContain("/auth");
    expect(txt).not.toContain("/welcome");
  });

  it("should end with a single trailing newline", () => {
    const txt = buildLlmsTxt(BASE_URL);

    expect(txt.endsWith("\n")).toBe(true);
    expect(txt.endsWith("\n\n")).toBe(false);
  });
});
