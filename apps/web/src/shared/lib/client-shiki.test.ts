import { describe, expect, it } from "vitest";

import { clientShiki } from "./client-shiki";

describe("clientShiki", () => {
  it("highlights common languages via the core bundle", async () => {
    const html = await clientShiki.highlight("const a = 1;", "javascript", "dark");

    expect(html).toContain("<pre");
    expect(html).toContain("shiki");
  });

  it("returns null for unknown languages instead of throwing", async () => {
    const html = await clientShiki.highlight("some text", "klingon", "dark");

    expect(html).toBeNull();
  });

  it("loads niche languages on demand (fortran, go)", async () => {
    const fortran = await clientShiki.highlight(
      "program hello\n  print *, 'hi'\nend program hello",
      "fortran",
      "dark",
    );
    expect(fortran).toContain("<pre");

    const go = await clientShiki.highlight("package main\n\nfunc main() {}", "go", "dark");
    expect(go).toContain("<pre");
  });

  it("resolves shiki aliases like py and js", async () => {
    const py = await clientShiki.highlight("print('hi')", "py", "dark");
    const js = await clientShiki.highlight("const c = 2;", "js", "dark");

    expect(py).toContain("<pre");
    expect(js).toContain("<pre");
  });

  it("maps light theme to github-light", async () => {
    const html = await clientShiki.highlight("const a = 1;", "typescript", "light");

    expect(html).toContain("github-light");
  });

  it("renders plain text pseudo-languages without a grammar", async () => {
    const html = await clientShiki.highlight("just text", "text", "dark");

    expect(html).toContain("<pre");
  });
});
