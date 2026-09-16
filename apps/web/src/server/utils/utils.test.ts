import { access, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";

import { join } from "pathe";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/core/realtime", () => ({
  realtimeService: { user: vi.fn(() => ({ publish: vi.fn() })) },
}));

vi.mock("@/server/core/db", () => ({ prisma: {} }));

import { cleanup, isBinaryBuffer, readAndFilterFiles } from "./utils";

describe("utils", () => {
  it("detects non-binary and binary buffers accurately", () => {
    expect(isBinaryBuffer(new Uint8Array())).toBe(false);
    expect(isBinaryBuffer(new TextEncoder().encode("hello world"))).toBe(false);
    expect(isBinaryBuffer(new Uint8Array([0x00, 0x01, 0x02, 0x03, 0x0a]))).toBe(true);
    expect(isBinaryBuffer(new Uint8Array([0x20, 0x41, 0x42, 0x43, 0x0a]))).toBe(false);
  });

  it("cleans up a temporary directory and ignores binary content while reading text files", async () => {
    const root = await mkdtemp(join(tmpdir(), "doxynix-utils-"));

    try {
      const textPath = join(root, "notes.txt");
      const binaryPath = join(root, "image.bin");

      await writeFile(textPath, "safe text\nsecond line\n");
      await writeFile(binaryPath, Buffer.from([0x00, 0x7f, 0xff, 0x00]));

      const files = await readAndFilterFiles(root, ["**/*"]);
      expect(files.map((file) => file.path)).toContain("notes.txt");
      expect(files.map((file) => file.path)).not.toContain("image.bin");

      await cleanup(root);
      await expect(access(root)).rejects.toThrow("ENOENT");
    } finally {
      await rm(root, { force: true, recursive: true });
    }
  });
});
