import { describe, expect, it } from "vitest";

import { getSizesFromClassName, isUnoptimizedHost } from "./avatar-utils";

describe("getSizesFromClassName", () => {
  it("maps known size classes to pixel sizes", () => {
    expect(getSizesFromClassName("size-9")).toBe("36px");
    expect(getSizesFromClassName("size-16")).toBe("64px");
    expect(getSizesFromClassName("size-32")).toBe("128px");
  });

  it("finds the size class among other classes", () => {
    expect(getSizesFromClassName("size-10 my-4 rounded-full")).toBe("40px");
  });

  it("returns the first matching key in map order", () => {
    expect(getSizesFromClassName("size-6 size-12")).toBe("24px");
  });

  it("defaults to 48px for an unknown or empty class", () => {
    expect(getSizesFromClassName("size-2")).toBe("48px");
    expect(getSizesFromClassName("")).toBe("48px");
  });
});

describe("isUnoptimizedHost", () => {
  it("flags exact allowed hosts", () => {
    expect(isUnoptimizedHost("https://utfs.io/a.png")).toBe(true);
    expect(isUnoptimizedHost("https://public.blob.vercel-storage.com/x")).toBe(true);
  });

  it("flags subdomains of allowed hosts", () => {
    expect(isUnoptimizedHost("https://cdn.utfs.io/a.png")).toBe(true);
    expect(isUnoptimizedHost("https://x.public.blob.vercel-storage.com/x")).toBe(true);
  });

  it("does not flag other hosts", () => {
    expect(isUnoptimizedHost("https://example.com/a.png")).toBe(false);
    expect(isUnoptimizedHost("https://utfs.io.evil.com/a.png")).toBe(false);
  });

  it("flags non-http protocols as unoptimized", () => {
    expect(isUnoptimizedHost("ftp://example.com/a.png")).toBe(true);
  });

  it("normalizes protocol and hostname case", () => {
    expect(isUnoptimizedHost("HTTPS://UTFS.IO/a.png")).toBe(true);
  });

  it("returns false for an invalid URL", () => {
    expect(isUnoptimizedHost("not a url")).toBe(false);
  });
});
