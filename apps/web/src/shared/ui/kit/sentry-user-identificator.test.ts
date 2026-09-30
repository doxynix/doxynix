// @vitest-environment jsdom
import { createElement } from "react";
import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { User } from "@/shared/lib/auth-client";

import { SentryUserIdentificator } from "./sentry-user-identificator";

const mocks = vi.hoisted(() => ({
  setTag: vi.fn(),
  setUser: vi.fn(),
}));

vi.mock("@sentry/nextjs", () => ({
  setTag: (...args: unknown[]) => mocks.setTag(...args),
  setUser: (...args: unknown[]) => mocks.setUser(...args),
}));

const user = {
  banExpires: null,
  banned: false,
  banReason: null,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  email: "ada@example.com",
  emailVerified: true,
  id: "7",
  image: null,
  name: "Ada",
  role: "USER",
  twoFactorEnabled: false,
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
} satisfies User;

describe("SentryUserIdentificator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.cookie = "last_request_id=; max-age=0; path=/";
  });

  it("sets the user and the request tag", async () => {
    document.cookie = "last_request_id=req_9; path=/";

    render(createElement(SentryUserIdentificator, { user }));

    await waitFor(() => {
      expect(mocks.setUser).toHaveBeenCalledWith({
        email: "ada@example.com",
        id: "7",
        role: "USER",
        username: "Ada",
      });
    });
    expect(mocks.setTag).toHaveBeenCalledWith("request_id", "req_9");
  });

  it("clears the user on unmount", async () => {
    const { unmount } = render(createElement(SentryUserIdentificator, { user }));

    unmount();

    await waitFor(() => {
      expect(mocks.setUser).toHaveBeenLastCalledWith(null);
    });
  });
});
