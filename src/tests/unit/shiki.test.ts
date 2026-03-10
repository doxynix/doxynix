import { beforeEach, describe, expect, it, vi } from "vitest";

const shikiState = vi.hoisted(() => ({
  codeToHtml:
    vi.fn<
      (code: string, options: { lang: string; theme: string; transformers: unknown[] }) => string
    >(),
  createHighlighter: vi.fn<
    (options: any) => Promise<{
      codeToHtml: (
        code: string,
        options: { lang: string; theme: string; transformers: unknown[] }
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

vi.mock("shiki/langs/console.mjs", () => ({ default: { id: "console" } }));
vi.mock("shiki/langs/json.mjs", () => ({ default: { id: "json" } }));
vi.mock("shiki/langs/markdown.mjs", () => ({ default: { id: "markdown" } }));
vi.mock("shiki/langs/typescript.mjs", () => ({ default: { id: "typescript" } }));

vi.mock("shiki/themes/github-dark-dimmed.mjs", () => ({ default: { id: "github-dark-dimmed" } }));
vi.mock("shiki/themes/github-light.mjs", () => ({ default: { id: "github-light" } }));

describe("highlightCode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();

    shikiState.codeToHtml.mockReturnValue("<pre>highlighted</pre>");
    shikiState.createHighlighter.mockResolvedValue({
      codeToHtml: shikiState.codeToHtml,
    });
  });

  it("should initialize highlighter only once with BOTH themes", async () => {
    const { highlightCode } = await import("@/shared/lib/shiki");

    await highlightCode("const a = 1;");
    await highlightCode("const b = 2;");

    expect(shikiState.createHighlighter).toHaveBeenCalledTimes(1);
    const callArgs = shikiState.createHighlighter.mock.calls[0][0] as any;
    expect(callArgs.themes).toContainEqual(expect.objectContaining({ id: "github-dark-dimmed" }));
    expect(callArgs.themes).toContainEqual(expect.objectContaining({ id: "github-light" }));
  });

  it("should use github-light when light theme is requested", async () => {
    const { highlightCode } = await import("@/shared/lib/shiki");

    await highlightCode("const x = 1", "typescript", "light");

    expect(shikiState.codeToHtml).toHaveBeenCalledWith(
      "const x = 1",
      expect.objectContaining({
        theme: "github-light",
      })
    );

    expect(unstableCacheMock).toHaveBeenCalledWith(
      expect.any(Function),
      expect.arrayContaining(["light"]),
      expect.any(Object)
    );
  });

  it("should use github-dark-dimmed by default (dark mode)", async () => {
    const { highlightCode } = await import("@/shared/lib/shiki");

    await highlightCode("const x = 1");

    expect(shikiState.codeToHtml).toHaveBeenCalledWith(
      "const x = 1",
      expect.objectContaining({
        theme: "github-dark-dimmed",
      })
    );

    expect(unstableCacheMock).toHaveBeenCalledWith(
      expect.any(Function),
      expect.arrayContaining(["dark"]),
      expect.any(Object)
    );
  });
});
