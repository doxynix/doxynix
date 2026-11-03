import { describe, expect, it } from "vitest";

import { buildDocsMetadata } from "./docs-metadata";

describe("buildDocsMetadata", () => {
  it("builds the canonical url for the docs index", () => {
    const metadata = buildDocsMetadata({ title: "Docs", url: "/docs" });

    expect(metadata.alternates?.canonical).toBe("http://localhost:3000/docs");
  });

  it("builds the canonical url for a nested page", () => {
    const metadata = buildDocsMetadata({ description: "Commands", title: "CLI", url: "/docs/cli" });

    expect(metadata.alternates?.canonical).toBe("http://localhost:3000/docs/cli");
    expect(metadata.description).toBe("Commands");
    expect(metadata.openGraph?.url).toBe("http://localhost:3000/docs/cli");
  });

  it("does not duplicate the trailing slash of APP_URL", () => {
    const metadata = buildDocsMetadata({ title: "Docs", url: "/docs" });

    expect(metadata.alternates?.canonical).not.toContain("//docs");
  });
});
