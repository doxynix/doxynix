import { beforeEach, describe, expect, it, vi } from "vitest";

import { createMetadata, createRepoMetadata } from "./metadata";

const getTranslationsMock = vi.hoisted(() =>
  vi.fn(async (namespace: string) => {
    return (key: string, values?: Record<string, string>) => {
      let result = `${namespace}:${key}`;
      if (values && Object.keys(values).length > 0) {
        const paramsStr = Object.entries(values)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([k, v]) => `${k}=${v}`)
          .join(";");
        result += `[${paramsStr}]`;
      }
      return result;
    };
  }),
);

vi.mock("next-intl/server", () => ({
  getTranslations: getTranslationsMock,
}));

describe("Metadata Factory Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createMetadata (Static Pages)", () => {
    it("should generate full metadata with title, description, OpenGraph and Twitter", async () => {
      const generateMetadata = createMetadata("dashboard_title", "dashboard_desc");

      const result = await generateMetadata();

      expect(getTranslationsMock).toHaveBeenCalledWith("Metadata");
      expect(result).toEqual({
        description: "Metadata:dashboard_desc",
        openGraph: {
          description: "Metadata:dashboard_desc",
          siteName: "Doxynix",
          title: "Metadata:dashboard_title",
          type: "website",
        },
        title: "Metadata:dashboard_title",
        twitter: {
          card: "summary_large_image",
          description: "Metadata:dashboard_desc",
          title: "Metadata:dashboard_title",
        },
      });
    });

    it("should handle optional description gracefully when only title is provided", async () => {
      const generateMetadata = createMetadata("landing_title");

      const result = await generateMetadata();

      expect(result).toEqual({
        description: undefined,
        openGraph: {
          description: undefined,
          siteName: "Doxynix",
          title: "Metadata:landing_title",
          type: "website",
        },
        title: "Metadata:landing_title",
        twitter: {
          card: "summary_large_image",
          description: undefined,
          title: "Metadata:landing_title",
        },
      });
    });
  });

  describe("createRepoMetadata (Dynamic Repository Pages)", () => {
    it("should default to 'overview' view when no argument is passed", async () => {
      const generateMetadata = createRepoMetadata();

      const result = await generateMetadata({
        params: Promise.resolve({
          name: "web",
          owner: "doxynix",
        }),
      });

      expect(getTranslationsMock).toHaveBeenCalledWith("Metadata");
      expect(result.title).toBe(
        "Metadata:repo_overview_title[name=web;number=;owner=doxynix;slug=doxynix/web]",
      );
      expect(result.description).toBe(
        "Metadata:repo_overview_desc[name=web;number=;owner=doxynix;slug=doxynix/web]",
      );
      expect(result.openGraph).toMatchObject({ siteName: "Doxynix" });
      expect(result.twitter).toMatchObject({ card: "summary_large_image" });
    });

    it.each([
      ["map", "repo_map_title", "repo_map_desc"],
      ["docs", "repo_docs_title", "repo_docs_desc"],
      ["code", "repo_code_title", "repo_code_desc"],
      ["pulls", "repo_pulls_title", "repo_pulls_desc"],
      ["settings", "repo_settings_title", "repo_settings_desc"],
      ["analyze", "repo_analyze_title", "repo_analyze_desc"],
    ] as const)(
      "should correctly resolve metadata for '%s' view",
      async (view, expectedTitleKey, expectedDescKey) => {
        const generateMetadata = createRepoMetadata(view);

        const result = await generateMetadata({
          params: Promise.resolve({
            name: "core",
            owner: "org",
          }),
        });

        expect(result.title).toBe(
          `Metadata:${expectedTitleKey}[name=core;number=;owner=org;slug=org/core]`,
        );
        expect(result.description).toBe(
          `Metadata:${expectedDescKey}[name=core;number=;owner=org;slug=org/core]`,
        );
        expect(result.twitter).toMatchObject({ card: "summary_large_image" });
      },
    );

    it("should correctly handle 'pull_detail' view with number parameter", async () => {
      const generateMetadata = createRepoMetadata("pull_detail");

      const result = await generateMetadata({
        params: Promise.resolve({
          name: "web",
          number: "42",
          owner: "doxynix",
        }),
      });

      expect(result.title).toBe(
        "Metadata:repo_pull_detail_title[name=web;number=42;owner=doxynix;slug=doxynix/web]",
      );
      expect(result.description).toBe(
        "Metadata:repo_pull_detail_desc[name=web;number=42;owner=doxynix;slug=doxynix/web]",
      );
      expect(result.twitter).toMatchObject({ card: "summary_large_image" });
    });

    it("should correctly handle 'owner' view where name is missing (slug = owner)", async () => {
      const generateMetadata = createRepoMetadata("owner");

      const result = await generateMetadata({
        params: Promise.resolve({
          owner: "facebook",
        }),
      });

      expect(result.title).toBe(
        "Metadata:repo_owner_title[name=;number=;owner=facebook;slug=facebook]",
      );
      expect(result.description).toBe(
        "Metadata:repo_owner_desc[name=;number=;owner=facebook;slug=facebook]",
      );
      expect(result.twitter).toMatchObject({ card: "summary_large_image" });
    });

    it("should handle empty or undefined params gracefully without crashing", async () => {
      const generateMetadata = createRepoMetadata("overview");

      const result = await generateMetadata({
        params: Promise.resolve({}),
      });

      expect(result.title).toBe("Metadata:repo_overview_title[name=;number=;owner=;slug=]");
      expect(result.description).toBe("Metadata:repo_overview_desc[name=;number=;owner=;slug=]");
      expect(result.twitter).toMatchObject({ card: "summary_large_image" });
    });
  });
});
