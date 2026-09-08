import { describe, expect, it } from "vitest";

import { extractAddedLinesFromPatch } from "@/server/utils/git-diff-parser";

describe("extractAddedLinesFromPatch", () => {
  it("returns empty array for empty or invalid patch", () => {
    expect(extractAddedLinesFromPatch("")).toEqual([]);
    expect(extractAddedLinesFromPatch("random non-patch text")).toEqual([]);
  });

  it("correctly extracts added lines and tracks target line numbers across hunks", () => {
    const patch = `
--- a/src/auth.ts
+++ b/src/auth.ts
@@ -10,6 +10,8 @@ export function login() {
   const user = getUser();
-  const oldToken = "123";
+  const token = "ghp_1234567890abcdef";
+  // TODO: remove log
   return token;
 }
@@ -30,4 +32,3 @@ export function logout() {
-  clearSession();
-  dropCookies();
+  invalidateAll();
   return true;
 }
`;

    const result = extractAddedLinesFromPatch(patch);

    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({
      content: '  const token = "ghp_1234567890abcdef";',
      lineAfter: 11,
    });
    expect(result[1]).toEqual({
      content: "  // TODO: remove log",
      lineAfter: 12,
    });
    expect(result[2]).toEqual({
      content: "  invalidateAll();",
      lineAfter: 32,
    });
  });

  it("ignores diff headers and metadata lines", () => {
    const patch = `
diff --git a/test.txt b/test.txt
index 0000000..1111111
--- a/test.txt
+++ b/test.txt
@@ -0,0 +1,2 @@
+Line one
+Line two
\\ No newline at end of file
`;
    const result = extractAddedLinesFromPatch(patch);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ content: "Line one", lineAfter: 1 });
    expect(result[1]).toEqual({ content: "Line two", lineAfter: 2 });
  });
});
