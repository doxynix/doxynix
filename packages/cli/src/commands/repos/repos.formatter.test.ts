import { describe, expect, it, vi } from "vitest";

import { renderRepoDetails, renderReposTable, renderSlimReposTable } from "./repos.formatter";

describe("repos formatter", () => {
  it("renders repository table rows", () => {
    const output = renderReposTable([
      {
        defaultBranch: "main",
        id: "12345678-1234-1234-1234-1234567890ab",
        language: "TypeScript",
        name: "platform",
        owner: "acme",
        securityScore: 82,
        stars: 42,
      },
    ] as any);

    expect(output).toContain("acme/platform");
    expect(output).toContain("TypeScript");
    expect(output).toContain("82/100");
    expect(output).toContain("main");
  });

  it("renders repo detail card with the target and metadata", () => {
    const renderSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    renderRepoDetails({
      defaultBranch: "main",
      description: "Platform",
      forks: 3,
      id: "12345678-1234-1234-1234-1234567890ab",
      language: "TypeScript",
      license: "MIT",
      name: "platform",
      owner: "acme",
      stars: 42,
      url: "https://github.com/acme/platform",
    } as any);

    expect(renderSpy).toHaveBeenCalledTimes(1);
    expect(renderSpy.mock.calls[0]?.[0]).toContain("acme/platform");
    expect(renderSpy.mock.calls[0]?.[0]).toContain("Platform");

    renderSpy.mockRestore();
  });

  it("renders the slim repo table with avatar fallback", () => {
    const output = renderSlimReposTable([
      { avatar: null, id: "12345678-1234-1234-1234-1234567890ab", name: "platform", owner: "acme" },
    ]);

    expect(output).toContain("acme/platform");
    expect(output).toContain("—");
  });
});
