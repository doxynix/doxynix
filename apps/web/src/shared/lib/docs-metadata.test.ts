import { describe, expect, it } from "vitest";

import { APP_URL } from "@/shared/config/env.client";

import { buildDocsCanonical, buildDocsMetadata } from "./docs-metadata";

describe("buildDocsCanonical", () => {
  it("appends the path to the base url", () => {
    expect(buildDocsCanonical("http://localhost:3000", "/docs")).toBe("http://localhost:3000/docs");
  });

  it("does not duplicate a trailing slash of the base url", () => {
    expect(buildDocsCanonical("http://localhost:3000/", "/docs")).toBe(
      "http://localhost:3000/docs",
    );
  });
});

describe("buildDocsMetadata", () => {
  it("builds the canonical url for the docs index", () => {
    const metadata = buildDocsMetadata({ title: "Docs", url: "/docs" });

    expect(metadata.alternates?.canonical).toBe(buildDocsCanonical(APP_URL, "/docs"));
  });

  it("builds the canonical url for a nested page", () => {
    const metadata = buildDocsMetadata({ description: "Commands", title: "CLI", url: "/docs/cli" });

    expect(metadata.alternates?.canonical).toBe(buildDocsCanonical(APP_URL, "/docs/cli"));
    expect(metadata.description).toBe("Commands");
    expect(metadata.openGraph?.url).toBe(buildDocsCanonical(APP_URL, "/docs/cli"));
  });
});
