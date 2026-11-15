// @vitest-environment jsdom
import { createElement } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type * as Nuqs from "nuqs";
import { afterEach, describe, expect, it, vi } from "vitest";

import { notificationsParsers } from "@/entities/notification/model/notifications-parsers";

import { NotificationsHeader } from "./notifications-header";

const { setFilters } = vi.hoisted(() => ({ setFilters: vi.fn() }));

vi.mock("nuqs", async (importOriginal) => {
  const actual = await importOriginal<typeof Nuqs>();

  return {
    ...actual,
    useQueryStates: () => [
      {
        from: null,
        isRead: true,
        limit: 20,
        owner: null,
        page: 1,
        repo: null,
        search: "",
        to: null,
        type: null,
      },
      setFilters,
    ],
  };
});

vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: () => (key: string) => key,
}));

vi.mock("./notifications-bulk-actions", () => ({ NotificationsBulkActions: () => null }));
vi.mock("./notifications-repo-filter", () => ({ NotificationsRepoFilter: () => null }));

describe("NotificationsHeader reset", () => {
  afterEach(() => {
    cleanup();
    setFilters.mockReset();
  });

  it("clears every field the header can activate, search and the paging keys included", () => {
    render(createElement(NotificationsHeader, {}));

    fireEvent.click(screen.getByRole("button", { name: "reset" }));

    expect(setFilters).toHaveBeenCalledTimes(1);
    const payload = setFilters.mock.calls[0]?.[0] as Record<string, unknown>;

    // `limit` is the one parser the reset may leave alone: it is a page size, not a filter.
    for (const key of Object.keys(notificationsParsers)) {
      if (key === "limit") {
        continue;
      }
      expect(payload[key]).toBeNull();
    }

    expect(payload.search).toBeNull();
    expect(payload.from).toBeNull();
  });
});
