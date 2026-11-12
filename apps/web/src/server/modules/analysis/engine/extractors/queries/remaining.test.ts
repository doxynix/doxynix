import { describe, expect, it } from "vitest";

import { createParser, getSpecByExt, loadLanguage } from "@/server/core/tree-sitter";

import { bashQuerySpec } from "./bash";
import { luaQuerySpec } from "./lua";
import { objcQuerySpec } from "./objc";
import { swiftQuerySpec } from "./swift";

function specFor(ext: string): Parameters<typeof loadLanguage>[1] {
  const spec = getSpecByExt(ext);
  expect(spec).toBeDefined();
  if (spec == null) {
    throw new Error(`missing grammar spec for ${ext}`);
  }
  return spec;
}

async function namesFor(
  ext: string,
  spec: Parameters<typeof loadLanguage>[1],
  querySource: string,
  content: string,
) {
  const parser = await createParser();
  try {
    const language = await loadLanguage(ext, spec);
    parser.setLanguage(language);
    const tree = parser.parse(content);
    try {
      const query = language.query(querySource);
      try {
        return query
          .captures(tree.rootNode)
          .filter((capture) => /^symbol\.[a-z]+\.name$/u.test(capture.name))
          .map((capture) => capture.node.text);
      } finally {
        query.delete();
      }
    } finally {
      tree.delete();
    }
  } finally {
    parser.delete();
  }
}

describe("remaining query specs", () => {
  it("captures bash functions and source commands", async () => {
    const spec = specFor(".sh");
    await expect(
      namesFor(".sh", spec, bashQuerySpec.symbols, "f() { echo x; }\n"),
    ).resolves.toEqual(["f"]);
  });

  it("captures lua local and module functions", async () => {
    const spec = specFor(".lua");
    await expect(
      namesFor(".lua", spec, luaQuerySpec.symbols, "local function f() end\nfunction M.g() end\n"),
    ).resolves.toEqual(["f", "g"]);
  });

  it("captures objc classes and methods", async () => {
    const spec = specFor(".m");
    await expect(
      namesFor(
        ".m",
        spec,
        objcQuerySpec.symbols,
        "@interface User : NSObject\n- (void)run:(int)a;\n@end\n",
      ),
    ).resolves.toEqual(["User", "run"]);
  });

  it("captures swift functions and classes", async () => {
    const spec = specFor(".swift");
    await expect(
      namesFor(
        ".swift",
        spec,
        swiftQuerySpec.symbols,
        "func greet() {}\nclass User { func run() {} }\n",
      ),
    ).resolves.toEqual(["greet", "User", "run"]);
  });
});
