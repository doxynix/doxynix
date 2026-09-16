import { describe, expect, it, vi } from "vitest";

import type { NotificationsParsersState } from "@/entities/notifications/model/notifications-parsers";

vi.mock("@/shared/api/trpc", () => ({}));

import { mapFiltersToInput } from "./use-notification-actions";

const makeFilters = (overrides: Partial<NotificationsParsersState>): NotificationsParsersState => ({
  isRead: null,
  limit: 20,
  owner: null,
  page: 1,
  repo: null,
  search: "",
  type: null,
  ...overrides,
});

describe("mapFiltersToInput", () => {
  it("returns an empty object when filters are undefined", () => {
    expect(mapFiltersToInput(undefined)).toEqual({});
  });

  it("turns every null field into undefined", () => {
    expect(mapFiltersToInput(makeFilters({}))).toEqual({
      repoName: undefined,
      repoOwner: undefined,
      search: undefined,
      type: undefined,
    });
  });

  it("maps repo/owner/search/type to the API input shape", () => {
    expect(
      mapFiltersToInput(
        makeFilters({ owner: "ivan", repo: "doxynix", search: "fix", type: "ERROR" }),
      ),
    ).toEqual({
      repoName: "doxynix",
      repoOwner: "ivan",
      search: "fix",
      type: "ERROR",
    });
  });

  it("keeps an empty repo string (??), but drops an empty search string (||)", () => {
    expect(mapFiltersToInput(makeFilters({ owner: "", repo: "", search: "" }))).toEqual({
      repoName: "",
      repoOwner: "",
      search: undefined,
      type: undefined,
    });
  });
});
