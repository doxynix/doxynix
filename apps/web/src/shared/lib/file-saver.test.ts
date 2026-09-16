import { afterEach, describe, expect, it, vi } from "vitest";

import { saveFile } from "@/shared/lib/file-saver";

describe("shared/lib/utils:saveFile", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("no-ops when window is undefined (SSR)", () => {
    expect(() => saveFile(new Blob(["x"]), "notes.txt")).not.toThrow();
  });

  it("creates a download link and revokes the object URL", async () => {
    const createObjectURL = vi.fn(() => "blob:mock-url");
    const revokeObjectURL = vi.fn();
    const click = vi.fn();
    const remove = vi.fn();
    const append = vi.fn();
    const anchor = {
      click,
      download: "",
      href: "",
      remove,
      style: {},
    };
    const documentMock = {
      body: { append },
      createElement: vi.fn(() => anchor),
    };

    vi.stubGlobal("window", {});
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });
    vi.stubGlobal("document", documentMock);

    const blob = new Blob(["data"], { type: "text/plain" });
    saveFile(blob, "notes.txt");

    expect(createObjectURL).toHaveBeenCalledWith(blob);
    expect(documentMock.createElement).toHaveBeenCalledWith("a");
    expect(anchor).toMatchObject({ download: "notes.txt", href: "blob:mock-url" });
    expect(append).toHaveBeenCalledWith(anchor);
    expect(click).toHaveBeenCalled();
    expect(remove).toHaveBeenCalled();

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:mock-url");
  });
});
