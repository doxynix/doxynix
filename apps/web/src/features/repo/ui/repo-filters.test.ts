// @vitest-environment jsdom
import { createElement } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type * as Nuqs from "nuqs";
import { afterEach, describe, expect, it, vi } from "vitest";

import { repoParsers } from "@/entities/repo/model/repo-parsers";

import { RepoFilters } from "./repo-filters";

const { setFilters } = vi.hoisted(() => ({ setFilters: vi.fn() }));

vi.mock("nuqs", async (importOriginal) => {
  const actual = await importOriginal<typeof Nuqs>();

  return {
    ...actual,
    useQueryStates: () => [
      {
        from: null,
        page: 1,
        search: "",
        sortBy: "updatedAt",
        status: "DONE",
        to: null,
        visibility: null,
      },
      setFilters,
    ],
  };
});

vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: () => (key: string) => key,
}));

describe("RepoFilters reset", () => {
  afterEach(() => {
    cleanup();
    setFilters.mockReset();
  });

  it("clears every field the toolbar can activate, search included", () => {
    render(createElement(RepoFilters));

    fireEvent.click(screen.getByRole("button", { name: "reset" }));

    expect(setFilters).toHaveBeenCalledTimes(1);
    const payload = setFilters.mock.calls[0]?.[0] as Record<string, unknown>;

    // A key the reset forgets stays in the URL and keeps the button enabled with no visible cause.
    expect(Object.keys(payload).sort()).toEqual(Object.keys(repoParsers).sort());
    expect(payload.search).toBeNull();
    expect(Object.values(payload).every((value) => value === null)).toBe(true);
  });
});
