import { describe, expect, it } from "vitest";

import {
  excludePath,
  getFileExtension,
  getFileName,
  uniqueObjectPaths,
  uniqueStringPaths,
} from "./path-operations";

describe("path-operations", () => {
  describe("getFileExtension", () => {
    it("should return correct extension for standard files", () => {
      expect(getFileExtension("/path/to/file.ts")).toBe(".ts");
      expect(getFileExtension("archive.tar.gz")).toBe(".gz");
      expect(getFileExtension("file")).toBe("");
      expect(getFileExtension("")).toBe("");
    });

    it("should handle dotfiles properly", () => {
      expect(getFileExtension(".gitignore")).toBe("");
      expect(getFileExtension(".env.local")).toBe(".local");
    });
  });

  describe("getFileName", () => {
    it("should return correct basename", () => {
      expect(getFileName("/path/to/file.ts")).toBe("file.ts");
      expect(getFileName("file.ts")).toBe("file.ts");
      expect(getFileName("")).toBe(".");
    });
  });

  describe("uniqueObjectPaths", () => {
    it("should deduplicate and apply numeric limit", () => {
      const items = [
        { path: "/a" },
        { path: "/b" },
        { path: "/a" }, // duplicate
        { path: "/b" }, // duplicate
      ];
      expect(uniqueObjectPaths(items)).toEqual(["/a", "/b"]);
      expect(uniqueObjectPaths(items, 1)).toEqual(["/a"]);
    });

    it("should normalize paths and deduplicate equivalent ones", () => {
      const items = [{ path: "/a/b/../c" }, { path: "/a/c" }];
      expect(uniqueObjectPaths(items)).toEqual(["/a/c"]);
    });

    it("should handle undefined and null limits", () => {
      const items = [{ path: "/a" }, { path: "/b" }];
      expect(uniqueObjectPaths(items, undefined)).toEqual(["/a", "/b"]);
      expect(uniqueObjectPaths(items, null as any)).toEqual(["/a", "/b"]);
    });
  });

  describe("uniqueStringPaths", () => {
    it("should deduplicate and apply numeric limit", () => {
      const paths = ["/a", "/b", "/a", "/c", ""];
      expect(uniqueStringPaths(paths)).toEqual(["/a", "/b", "/c"]);
      expect(uniqueStringPaths(paths, 2)).toEqual(["/a", "/b"]);
    });

    it("should handle undefined and null limits", () => {
      const paths = ["/a", "/b"];
      expect(uniqueStringPaths(paths, undefined)).toEqual(["/a", "/b"]);
      expect(uniqueStringPaths(paths, null as any)).toEqual(["/a", "/b"]);
    });
  });

  describe("excludePath", () => {
    it("should filter out the target path and respect limit", () => {
      const paths = ["/a", "/b", "/c", "/d"];
      expect(excludePath(paths, "/b")).toEqual(["/a", "/c", "/d"]);
      expect(excludePath(paths, "/b", 2)).toEqual(["/a", "/c"]);
    });

    it("should return all paths if target path is not found", () => {
      const paths = ["/a", "/b"];
      expect(excludePath(paths, "/non-existent")).toEqual(["/a", "/b"]);
    });
  });
});
