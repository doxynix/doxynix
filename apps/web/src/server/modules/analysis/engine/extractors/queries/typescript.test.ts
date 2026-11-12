import { describe, expect, it } from "vitest";

import { createParser, getSpecByExt, loadLanguage } from "@/server/core/tree-sitter";

import { typescriptQuerySpec } from "./typescript";

const FIXTURE = [
  'import { Hono } from "hono";',
  "export function greet(name: string) { return name; }",
  "class UserService { run() {} }",
  "interface UserRepo { find(): void }",
  "type Id = string;",
  "enum Role { Admin }",
  'const app = new Hono(); app.get("/users", handler);',
].join("\n");

function tsSpec() {
  const spec = getSpecByExt(".ts");
  expect(spec).toBeDefined();
  if (spec == null) {
    throw new Error("missing grammar spec");
  }
  return spec;
}

describe("typescriptQuerySpec", () => {
  it("captures real symbol names", async () => {
    const spec = tsSpec();

    const parser = await createParser();
    const language = await loadLanguage(".ts", spec);
    parser.setLanguage(language);
    const tree = parser.parse(FIXTURE);
    const query = language.query(typescriptQuerySpec.symbols);

    const names = query
      .captures(tree.rootNode)
      .filter((capture) => /^symbol\.[a-z]+\.name$/u.test(capture.name))
      .map((capture) => capture.node.text);

    expect(names).toEqual(["greet", "UserService", "run", "UserRepo", "Id", "Role"]);

    query.delete();
    tree.delete();
    parser.delete();
  });
});
