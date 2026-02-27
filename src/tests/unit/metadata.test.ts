import { beforeEach, describe, expect, it, vi } from "vitest";

import { createMetadata } from "@/shared/lib/metadata";

const getTranslationsMock = vi.hoisted(() =>
  vi.fn(async ({ locale, namespace }: { locale: string; namespace: string }) => {
    return (key: string) => `${namespace}:${locale}:${key}`;
  })
);

vi.mock("next-intl/server", () => ({
  getTranslations: getTranslationsMock,
}));

describe("createMetadata", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should resolve metadata with translated title and description", async () => {
    const factory = createMetadata("home_title", "home_description");

    const metadata = await factory({
      params: Promise.resolve({ locale: "en" }),
    });

    expect(metadata).toEqual({
      description: "Metadata:en:home_description",
      title: "Metadata:en:home_title",
    });
  });

  it("should call getTranslations with locale and Metadata namespace", async () => {
    const factory = createMetadata("a", "b");

    await factory({
      params: Promise.resolve({ locale: "ru" }),
    });

    expect(getTranslationsMock).toHaveBeenCalledWith({
      locale: "ru",
      namespace: "Metadata",
    });
  });
});
