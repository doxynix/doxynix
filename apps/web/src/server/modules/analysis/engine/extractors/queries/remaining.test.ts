import { describe, expect, it } from "vitest";
import type Parser from "web-tree-sitter";

import { createParser, getSpecByExt, loadLanguage } from "@/server/core/tree-sitter";

import { bashQuerySpec } from "./bash";
import { QUERY_SPECS } from "./index";
import { luaQuerySpec } from "./lua";
import { objcQuerySpec } from "./objc";
import { swiftQuerySpec } from "./swift";
import type { LanguageQuerySpec } from "./types";

const REMAINING_EXTENSIONS = [".sh", ".lua", ".m", ".swift"] as const;

const REQUIRED_SECTIONS = ["symbols", "imports", "complexity", "calls"] as const;

const OPTIONAL_SECTIONS = ["routes", "entrypoints"] as const;

function specFor(ext: string): Parameters<typeof loadLanguage>[1] {
  const spec = getSpecByExt(ext);
  expect(spec).toBeDefined();
  if (spec == null) {
    throw new Error(`missing grammar spec for ${ext}`);
  }
  return spec;
}

function querySpecFor(ext: string): LanguageQuerySpec {
  const spec = QUERY_SPECS[ext];
  expect(spec).toBeDefined();
  if (spec == null) {
    throw new Error(`missing query spec for ${ext}`);
  }
  return spec;
}

async function queryTexts(
  ext: string,
  spec: Parameters<typeof loadLanguage>[1],
  querySource: string,
  content: string,
  predicate: (capture: Parser.QueryCapture) => boolean,
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
          .filter(predicate)
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

function namesFor(ext: string, querySource: string, content: string): Promise<string[]> {
  return queryTexts(ext, specFor(ext), querySource, content, (capture) =>
    /^symbol\.[a-z]+\.name$/u.test(capture.name),
  );
}

function importSourcesFor(
  ext: string,
  spec: LanguageQuerySpec,
  content: string,
): Promise<string[]> {
  return queryTexts(
    ext,
    specFor(ext),
    spec.imports,
    content,
    (capture) => capture.name === "import.source",
  );
}

function compileSection(language: Parser.Language, ext: string, section: string, source: string) {
  try {
    const query = language.query(source);
    query.delete();
  } catch (error) {
    throw new Error(`query section "${section}" failed for ${ext}`, { cause: error });
  }
}

describe("remaining query specs", () => {
  it("captures bash functions and source imports", async () => {
    const content = "f() { echo x; }\nsource lib.sh\n";
    await expect(namesFor(".sh", bashQuerySpec.symbols, content)).resolves.toEqual(["f"]);
    await expect(importSourcesFor(".sh", bashQuerySpec, content)).resolves.toEqual(["lib.sh"]);
  });

  it("captures lua local and module functions plus require imports", async () => {
    const content = 'local function f() end\nfunction M.g() end\nlocal m = require("m")\n';
    await expect(namesFor(".lua", luaQuerySpec.symbols, content)).resolves.toEqual(["f", "g"]);
    await expect(importSourcesFor(".lua", luaQuerySpec, content)).resolves.toEqual(['"m"']);
  });

  it("captures objc classes, categories, methods and imports", async () => {
    const content =
      '#import "X.h"\n#include <stdio.h>\n@import UIKit;\n@interface User : NSObject\n- (void)run:(int)a;\n@end\n';
    await expect(namesFor(".m", objcQuerySpec.symbols, content)).resolves.toEqual(["User", "run"]);
    await expect(importSourcesFor(".m", objcQuerySpec, content)).resolves.toEqual([
      '"X.h"',
      "<stdio.h>",
      "UIKit",
    ]);

    const category = "@interface User (Cat)\n@end\n@implementation User (Cat)\n@end\n";
    await expect(namesFor(".m", objcQuerySpec.symbols, category)).resolves.toEqual([
      "User",
      "Cat",
      "User",
      "Cat",
    ]);
  });

  it("captures swift functions and classes plus imports", async () => {
    const content = "import Foundation\nfunc greet() {}\nclass User { func run() {} }\n";
    await expect(namesFor(".swift", swiftQuerySpec.symbols, content)).resolves.toEqual([
      "greet",
      "User",
      "run",
    ]);
    await expect(importSourcesFor(".swift", swiftQuerySpec, content)).resolves.toEqual([
      "Foundation",
    ]);
  });

  it.each(REMAINING_EXTENSIONS)("compiles every non-empty %s query section", async (ext) => {
    const querySpec = querySpecFor(ext);
    const parser = await createParser();
    try {
      const language = await loadLanguage(ext, specFor(ext));
      for (const section of REQUIRED_SECTIONS) {
        const source = querySpec[section] ?? "";
        expect(source.trim().length, `${ext} ${section} must not be empty`).toBeGreaterThan(0);
        compileSection(language, ext, section, source);
      }
      for (const section of OPTIONAL_SECTIONS) {
        const source = querySpec[section];
        if (source.trim().length === 0) {
          continue;
        }
        compileSection(language, ext, section, source);
      }
    } finally {
      parser.delete();
    }
  });
});
