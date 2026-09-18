import { describe, expect, it } from "vitest";

import { saveFile } from "@/shared/lib/file-saver";

describe("saveFile", () => {
  it("should gracefully no-op when window is undefined during server side rendering", () => {
    expect(() => saveFile(new Blob(["x"]), "notes.txt")).not.toThrow();
  });
});
