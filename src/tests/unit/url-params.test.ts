import { describe, expect, it } from "vitest";

import {
  getSingleParam,
  isNonEmptyString,
  parseEnum,
  parseStringUnion,
} from "@/shared/lib/url-params";

describe("url-params helpers", () => {
  describe("isNonEmptyString", () => {
    it("should return true only for non-empty trimmed strings", () => {
      expect(isNonEmptyString("value")).toBe(true);
      expect(isNonEmptyString("  value  ")).toBe(true);
      expect(isNonEmptyString("   ")).toBe(false);
      expect(isNonEmptyString("")).toBe(false);
      expect(isNonEmptyString(undefined)).toBe(false);
      expect(isNonEmptyString(null)).toBe(false);
    });
  });

  describe("getSingleParam", () => {
    it("should return raw string when param is string", () => {
      expect(getSingleParam("alpha")).toBe("alpha");
    });

    it("should return first item when param is array", () => {
      expect(getSingleParam(["first", "second"])).toBe("first");
    });

    it("should return undefined for undefined param", () => {
      expect(getSingleParam(undefined)).toBeUndefined();
    });

    it("should return undefined for empty array", () => {
      expect(getSingleParam([])).toBeUndefined();
    });
  });

  describe("parseEnum", () => {
    const visibilityEnum = {
      PRIVATE: "PRIVATE",
      PUBLIC: "PUBLIC",
    } as const;

    it("should return enum value when string param is valid", () => {
      expect(parseEnum("PRIVATE", visibilityEnum)).toBe("PRIVATE");
    });

    it("should return enum value when first array item is valid", () => {
      expect(parseEnum(["PUBLIC", "PRIVATE"], visibilityEnum)).toBe("PUBLIC");
    });

    it("should return undefined for invalid, empty or missing values", () => {
      expect(parseEnum("UNKNOWN", visibilityEnum)).toBeUndefined();
      expect(parseEnum("   ", visibilityEnum)).toBeUndefined();
      expect(parseEnum(undefined, visibilityEnum)).toBeUndefined();
    });
  });

  describe("parseStringUnion", () => {
    const validSort = ["asc", "desc"] as const;

    it("should return provided value when it is in the whitelist", () => {
      expect(parseStringUnion("asc", validSort, "desc")).toBe("asc");
    });

    it("should return first array value when it is valid", () => {
      expect(parseStringUnion(["desc", "asc"], validSort, "asc")).toBe("desc");
    });

    it("should fallback to default for empty, invalid and missing params", () => {
      expect(parseStringUnion("", validSort, "asc")).toBe("asc");
      expect(parseStringUnion("invalid", validSort, "asc")).toBe("asc");
      expect(parseStringUnion(undefined, validSort, "desc")).toBe("desc");
    });
  });
});
