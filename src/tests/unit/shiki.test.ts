import { beforeEach, describe, expect, it, vi } from "vitest";

const shikiState = vi.hoisted(() => ({
  codeToHtml:
    vi.fn<
      (
        code: string,
        options: { lang: string; theme: "github-dark-dimmed"; transformers: unknown[] }
      ) => string
    >(),
  createHighlighter: vi.fn<
    () => Promise<{
      codeToHtml: (
        code: string,
        options: { lang: string; theme: "github-dark-dimmed"; transformers: unknown[] }
      ) => string;
    }>
  >(),
}));

const unstableCacheMock = vi.hoisted(() =>
  vi.fn(
    (fn: () => Promise<string>, _keys: string[], _options: { revalidate: false; tags: string[] }) =>
      fn
  )
);

vi.mock("next/cache", () => ({
  unstable_cache: unstableCacheMock,
}));

vi.mock("shiki", () => ({
  createHighlighter: shikiState.createHighlighter,
}));

vi.mock("shiki/langs/console.mjs", () => ({
  default: { id: "console" },
}));

vi.mock("shiki/langs/json.mjs", () => ({
  default: { id: "json" },
}));

vi.mock("shiki/langs/markdown.mjs", () => ({
  default: { id: "markdown" },
}));

vi.mock("shiki/langs/typescript.mjs", () => ({
  default: { id: "typescript" },
}));

vi.mock("shiki/themes/github-dark-dimmed.mjs", () => ({
  default: { id: "github-dark-dimmed" },
}));

describe("highlightCode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();

    shikiState.codeToHtml.mockReturnValue("<pre>highlighted</pre>");
    shikiState.createHighlighter.mockResolvedValue({
      codeToHtml: shikiState.codeToHtml,
    });
  });

  it("should initialize highlighter only once and reuse singleton between calls", async () => {
    const { highlightCode } = await import("@/shared/lib/shiki");

    const first = await highlightCode("const a = 1;");
    const second = await highlightCode("const b = 2;");

    expect(first).toBe("<pre>highlighted</pre>");
    expect(second).toBe("<pre>highlighted</pre>");
    expect(shikiState.createHighlighter).toHaveBeenCalledTimes(1);
    expect(shikiState.codeToHtml).toHaveBeenCalledTimes(2);
  });

  it("should return highlighted html string and normalize light theme to github-dark-dimmed for the highlighter", async () => {
    shikiState.codeToHtml.mockReturnValue("<pre>console</pre>");
    const { highlightCode } = await import("@/shared/lib/shiki");

    const html = await highlightCode("console.log('x')", "console", "light");

    expect(html).toBe("<pre>console</pre>");
    expect(shikiState.codeToHtml).toHaveBeenCalledWith("console.log('x')", {
      lang: "console",
      theme: "github-dark-dimmed",
      transformers: [],
    });
    expect(unstableCacheMock).toHaveBeenCalledTimes(1);
  });
});
