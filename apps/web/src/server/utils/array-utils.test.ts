import { describe, expect, it } from "vitest";

import { uniquePaths } from "./array-utils";

describe("array-utils", () => {
  describe("uniquePaths", () => {
    it("should return unique non-empty paths", () => {
      const paths = ["/a", "/b", "/a", "", null, undefined, "/c"];
      expect(uniquePaths(paths)).toEqual(["/a", "/b", "/c"]);
    });

    it("should apply limit if provided", () => {
      const paths = ["/a", "/b", "/c", "/d"];
      expect(uniquePaths(paths, 2)).toEqual(["/a", "/b"]);
    });

    it("should accept any Iterable (e.g. Set)", () => {
      const pathSet = new Set(["/x", "/y", "/x", ""]);
      expect(uniquePaths(pathSet)).toEqual(["/x", "/y"]);
    });

    it("should handle limit 0 and limit greater than length", () => {
      const paths = ["/a", "/b"];
      expect(uniquePaths(paths, 0)).toEqual([]);
      expect(uniquePaths(paths, 100)).toEqual(["/a", "/b"]);
    });

    it("should return all items when limit is not a number", () => {
      const paths = ["/a", "/b"];
      // @ts-expect-error - testing invalid type
      expect(uniquePaths(paths, "invalid")).toEqual(["/a", "/b"]);
      expect(uniquePaths(paths, undefined)).toEqual(["/a", "/b"]);
    });
  });
});
