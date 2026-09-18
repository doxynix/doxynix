import { describe, expect, it } from "vitest";

import { parseProgress, parseStatusMessage, parseTaskLogs } from "./realtime-parsers";

describe("analysisParsers", () => {
  describe("parseProgress", () => {
    it("should successfully parse valid numbers within the 0 to 100 range", () => {
      expect(parseProgress(0)).toBe(0);
      expect(parseProgress(50)).toBe(50);
      expect(parseProgress(100)).toBe(100);
    });

    it("should fallback to 0 when number exceeds the maximum or minimum bounds", () => {
      expect(parseProgress(-1)).toBe(0);
      expect(parseProgress(101)).toBe(0);
    });

    it("should fallback to 0 when input value is malformed or invalid type", () => {
      expect(parseProgress("50")).toBe(0);
      expect(parseProgress(null)).toBe(0);
      expect(parseProgress(undefined)).toBe(0);
      expect(parseProgress({})).toBe(0);
    });
  });

  describe("parseStatusMessage", () => {
    it("should extract valid string logs successfully", () => {
      expect(parseStatusMessage("Cloning repository...")).toBe("Cloning repository...");
    });

    it("should fallback to default analyzing text placeholder on invalid types", () => {
      expect(parseStatusMessage(null)).toBe("Analyzing repository…");
      expect(parseStatusMessage(123)).toBe("Analyzing repository…");
      expect(parseStatusMessage({})).toBe("Analyzing repository…");
    });
  });

  describe("parseTaskLogs", () => {
    it("should return the exact same array when input is a valid string array", () => {
      const logs = ["step 1", "step 2"];
      expect(parseTaskLogs(logs)).toEqual(logs);
    });

    it("should fallback to an empty array when input data type is malformed", () => {
      expect(parseTaskLogs(null)).toEqual([]);
      expect(parseTaskLogs("not-an-array")).toEqual([]);
      expect(parseTaskLogs({})).toEqual([]);
    });
  });
});
