import { describe, expect, it } from "vitest";

import { FixService } from "./fix-generator";

describe("FixService.applySearchReplace", () => {
  const apply = (original: string, response: string, path = "test.ts") =>
    (FixService as any).applySearchReplace(original, response, path);

  it("applies exact search and replace block", () => {
    const original = `function add(a, b) {\n  return a - b;\n}`;
    const response = `<file path="test.ts">
<<<<<<< SEARCH
  return a - b;
=======
  return a + b;
>>>>>>> REPLACE
</file>`;

    const result = apply(original, response);
    expect(result).toBe(`function add(a, b) {\n  return a + b;\n}`);
  });

  it("applies replace when indentation in target file differs", () => {
    const original = `    const x = 1;\n    const y = 2;`;
    const response = `<<<<<<< SEARCH
const x = 1;
const y = 2;
=======
const x = 10;
const y = 20;
>>>>>>> REPLACE`;

    const result = apply(original, response);
    expect(result).toBe(`    const x = 10;\n    const y = 20;`);
  });

  it("leaves file unchanged when search block has zero match", () => {
    const original = `console.log("hello");`;
    const response = `<<<<<<< SEARCH
const missing = true;
=======
const present = true;
>>>>>>> REPLACE`;

    const result = apply(original, response);
    expect(result).toBe(original);
  });
});
