import { describe, expect, it } from "vitest";

import { parseGitUrl } from "./git-url";

describe("parseGitUrl", () => {
  describe("shorthand format", () => {
    it("parses owner/repo", () => {
      const result = parseGitUrl("owner/repo");
      expect(result).toEqual({
        full_name: "owner/repo",
        href: "https://github.com/owner/repo.git",
        name: "repo",
        owner: "owner",
        port: null,
        protocol: "https",
        resource: "github.com",
      });
    });

    it("strips .git suffix from repo name", () => {
      const result = parseGitUrl("owner/repo.git");
      expect(result.full_name).toBe("owner/repo");
      expect(result.name).toBe("repo");
    });
  });

  describe("SCP format", () => {
    it("parses git@github.com:owner/repo.git", () => {
      const result = parseGitUrl("git@github.com:owner/repo.git");
      expect(result).toEqual({
        full_name: "owner/repo",
        href: "git@github.com:owner/repo.git",
        name: "repo",
        owner: "owner",
        port: null,
        protocol: "ssh",
        resource: "github.com",
      });
    });

    it("parses SCP format without user", () => {
      const result = parseGitUrl("github.com:owner/repo");
      expect(result.protocol).toBe("ssh");
      expect(result.resource).toBe("github.com");
      expect(result.full_name).toBe("owner/repo");
    });
  });

  describe("HTTPS format", () => {
    it("parses standard HTTPS URL", () => {
      const result = parseGitUrl("https://github.com/owner/repo.git");
      expect(result).toEqual({
        full_name: "owner/repo",
        href: "https://github.com/owner/repo.git",
        name: "repo",
        owner: "owner",
        port: null,
        protocol: "https",
        resource: "github.com",
      });
    });

    it("parses URL with custom port", () => {
      const result = parseGitUrl("https://host.example.com:8443/a/b.git");
      expect(result.port).toBe(8443);
      expect(result.full_name).toBe("a/b");
      expect(result.resource).toBe("host.example.com");
    });
  });

  describe("error cases", () => {
    it("throws on whitespace-only input", () => {
      expect(() => parseGitUrl("  ")).toThrow("Field cannot be empty");
    });

    it("throws on empty string", () => {
      expect(() => parseGitUrl("")).toThrow("Field cannot be empty");
    });

    it("throws on invalid input", () => {
      expect(() => parseGitUrl("not a url")).toThrow("Invalid Git URL format");
    });
  });
});
