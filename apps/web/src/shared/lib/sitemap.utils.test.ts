import { describe, expect, it } from "vitest";

import { getSitemapUrl } from "./sitemap.utils";

describe("getSitemapUrl", () => {
  const baseUrl = "https://doxynix.space";
  const defaultLocale = "en";

  it("should return root domain url without prefix for default locale and empty path", () => {
    const result = getSitemapUrl(baseUrl, "", "en", defaultLocale);
    expect(result).toBe("https://doxynix.space");
  });

  it("should append locale prefix for non-default languages on empty path", () => {
    const result = getSitemapUrl(baseUrl, "", "ru", defaultLocale);
    expect(result).toBe("https://doxynix.space/ru");
  });

  it("should correctly concatenate paths for the default locale omitting language prefix", () => {
    const result = getSitemapUrl(baseUrl, "about", "en", defaultLocale);
    expect(result).toBe("https://doxynix.space/about");
  });

  it("should successfully build fully localized paths for non-default languages", () => {
    const result = getSitemapUrl(baseUrl, "support", "ru", defaultLocale);
    expect(result).toBe("https://doxynix.space/ru/support");
  });

  it("should sanitize and safely trim leading slashes from input paths", () => {
    const resultWithSlash = getSitemapUrl(baseUrl, "/high-five", "de", defaultLocale);
    expect(resultWithSlash).toBe("https://doxynix.space/de/high-five");
  });

  it("should gracefully handle raw domain strings missing trailing slash parameters", () => {
    const rawDomain = "https://doxynix.space";
    const result = getSitemapUrl(rawDomain, "privacy", "en", defaultLocale);
    expect(result).toBe("https://doxynix.space/privacy");
  });

  it("should remove trailing slash from the base URL before building the sitemap URL", () => {
    const result = getSitemapUrl("https://doxynix.space/", "/privacy", "en", defaultLocale);
    expect(result).toBe("https://doxynix.space/privacy");
  });
});
