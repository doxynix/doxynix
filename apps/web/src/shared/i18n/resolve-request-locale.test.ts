import { describe, expect, it } from "vitest";

import { LOCALES } from "@/shared/config/locales";

import { parseAcceptLanguage } from "./resolve-request-locale";

describe("parseAcceptLanguage", () => {
  it("returns the exact match for a bare tag", () => {
    expect(parseAcceptLanguage("ru", LOCALES)).toBe("ru");
  });

  it("prefers the highest-q supported entry", () => {
    expect(parseAcceptLanguage("ru;q=0.4, de;q=0.9", LOCALES)).toBe("de");
  });

  it("keeps header order when q values tie", () => {
    expect(parseAcceptLanguage("ru;q=0.5, de;q=0.5", LOCALES)).toBe("ru");
  });

  it("falls back to the base tag of a regional variant", () => {
    expect(parseAcceptLanguage("ru-RU,ru;q=0.9", LOCALES)).toBe("ru");
  });

  it("matches a multi-part tag case-insensitively and returns the canonical form", () => {
    expect(parseAcceptLanguage("pt-br", LOCALES)).toBe("pt-BR");
    expect(parseAcceptLanguage("ZH-cn", LOCALES)).toBe("zh-CN");
  });

  it("matches a bare tag case-insensitively", () => {
    expect(parseAcceptLanguage("DE", LOCALES)).toBe("de");
  });

  it("clamps an out-of-range q instead of letting it win", () => {
    expect(parseAcceptLanguage("sv-SE;q=5, ru;q=0.1", LOCALES)).toBe("ru");
  });

  it("treats q=0 as explicitly unacceptable", () => {
    expect(parseAcceptLanguage("ru;q=0, de", LOCALES)).toBe("de");
  });

  it("returns undefined when nothing is supported", () => {
    expect(parseAcceptLanguage("sv-SE,sv;q=0.9", LOCALES)).toBeUndefined();
  });

  it("returns undefined for a null header", () => {
    expect(parseAcceptLanguage(null, LOCALES)).toBeUndefined();
  });

  it("treats an unparsable q list as unsupported rather than throwing", () => {
    expect(parseAcceptLanguage(";;;", LOCALES)).toBeUndefined();
  });

  it("falls back to the default locale's position for a wildcard", () => {
    expect(parseAcceptLanguage("*", LOCALES)).toBeUndefined();
  });
});
