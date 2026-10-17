import { describe, expect, it } from "vitest";

import { resolveBinName } from "./bin-name";

describe("resolveBinName", () => {
  it("uses dxnx when invoked through the npm install path", () => {
    expect(
      resolveBinName([
        "bun",
        "/home/u/.bun/install/global/node_modules/@doxynix/cli/dist/index.js",
      ]),
    ).toBe("dxnx");
  });

  it("uses doxynix only when the invoked binary itself is named doxynix", () => {
    expect(resolveBinName(["bun", "/opt/bin/doxynix"])).toBe("doxynix");
  });

  it("falls back to dxnx when argv[1] is missing", () => {
    expect(resolveBinName(["bun"])).toBe("dxnx");
  });

  it("ignores the package name entirely", () => {
    expect(resolveBinName(["bun", "/srv/@doxynix/cli/dist/index.js"])).toBe("dxnx");
  });
});
