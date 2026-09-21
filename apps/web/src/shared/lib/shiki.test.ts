import { describe, expect, it, vi } from "vitest";

import { highlightCode } from "@/shared/lib/shiki";

const unstableCacheMock = vi.hoisted(() => vi.fn((fn: () => Promise<string>) => fn));

vi.mock("next/cache", () => ({ unstable_cache: unstableCacheMock }));

describe("highlightCode", () => {
  it("highlights code and returns shiki HTML", async () => {
    const html = await highlightCode("const a = 1;");

    expect(html).toContain("<pre");
    expect(html).toContain("shiki");
  });

  it("maps dark/light themes to github themes", async () => {
    const dark = await highlightCode("const a = 1;");
    const light = await highlightCode("const a = 1;", "typescript", "light");

    expect(dark).toContain("github-dark-dimmed");
    expect(light).toContain("github-light");
  });

  it("resolves aliases like py -> python and golang -> go", async () => {
    const py = await highlightCode("print('hi')", "py");
    const golang = await highlightCode("package main", "golang");

    expect(py).toContain("shiki");
    expect(golang).toContain("shiki");
  });

  it("highlights niche languages like fortran and go", async () => {
    const fortran = await highlightCode(
      "program hello\n  print *, 'hi'\nend program hello",
      "fortran",
    );
    const go = await highlightCode("package main\n\nfunc main() {}", "go");

    expect(fortran).toContain("<pre");
    expect(go).toContain("<pre");
  });

  it("does not throw for unknown languages and falls back to plain text", async () => {
    const html = await highlightCode("some text", "klingon");

    expect(html).toContain("<pre");
  });

  it("passes cache key parts to unstable_cache", async () => {
    await highlightCode("const c = 3;", "typescript", "light");

    expect(unstableCacheMock).toHaveBeenCalledWith(
      expect.any(Function),
      expect.arrayContaining(["light", "typescript"]),
      expect.any(Object),
    );
  });
});
