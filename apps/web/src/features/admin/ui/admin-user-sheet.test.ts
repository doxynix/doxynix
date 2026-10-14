// @vitest-environment jsdom
import { createElement, type ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: () => (key: string) => key,
}));

const getDetail = vi.fn();
const listSessions = vi.fn();

vi.mock("@/shared/api/trpc", () => ({
  trpc: {
    adminUser: {
      getDetail: { useQuery: (input: unknown, options: unknown) => getDetail(input, options) },
      listSessions: { useQuery: (input: unknown) => listSessions(input) },
    },
  },
}));

vi.mock("@/shared/ui/core/sheet", () => ({
  Sheet: ({ children }: { children: ReactNode }) => createElement("div", null, children),
  SheetContent: ({ children }: { children: ReactNode }) =>
    createElement("div", { "data-testid": "sheet-content" }, children),
  SheetDescription: ({ children }: { children: ReactNode }) => createElement("p", null, children),
  SheetHeader: ({ children }: { children: ReactNode }) => createElement("div", null, children),
  SheetTitle: ({ children }: { children: ReactNode }) => createElement("h2", null, children),
}));

import { AdminUserSheet } from "./admin-user-sheet";

const USER_ID = "0195a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5d";

function detail(overrides: Record<string, unknown> = {}) {
  return {
    data: {
      banExpires: null,
      banned: false,
      banReason: null,
      counts: { apiKeys: 0, chatSessions: 0, notifications: 0, repos: 3, sessions: 1 },
      createdAt: new Date("2026-01-01T00:00:00Z"),
      email: "alice@test.com",
      emailVerified: true,
      id: USER_ID,
      image: null,
      lastLoginMethod: "magic-link",
      name: "Alice",
      role: "ADMIN",
      twoFactorEnabled: true,
      updatedAt: new Date("2026-02-01T00:00:00Z"),
      ...overrides,
    },
    isLoading: false,
  };
}

function mount(props: { open?: boolean } = {}) {
  return render(
    createElement(AdminUserSheet, {
      actions: {
        deleteUser: { isPending: false, mutate: vi.fn() },
        revokeSession: { isPending: false, mutate: vi.fn() },
        setBanned: { isPending: false, mutate: vi.fn() },
        setRole: { isPending: false, mutate: vi.fn() },
      } as never,
      onOpenChange: vi.fn(),
      open: props.open ?? true,
      userId: USER_ID,
    }),
  );
}

describe("AdminUserSheet", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getDetail.mockReturnValue(detail());
    listSessions.mockReturnValue({ data: { items: [] }, isLoading: false });

    window.matchMedia = ((query: string) => ({
      addEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
      matches: false,
      media: query,
      onchange: null,
      removeEventListener: vi.fn(),
    })) as unknown as typeof window.matchMedia;
  });

  it("shows each relation count from the detail query", () => {
    mount();

    expect(screen.getByTestId("count-repos").textContent).toContain("3");
    expect(screen.getByTestId("count-sessions").textContent).toContain("1");
    expect(screen.getByTestId("count-apiKeys").textContent).toContain("0");
  });

  it("only queries while the sheet is open", () => {
    mount({ open: false });

    expect(getDetail).toHaveBeenCalledWith({ id: USER_ID }, { enabled: false });
  });

  it("names the user rather than showing a bare id", () => {
    mount();

    expect(screen.getByText("Alice")).not.toBeNull();
    expect(screen.getByText("alice@test.com")).not.toBeNull();
  });

  it("falls back to the id when the user has no name", () => {
    getDetail.mockReturnValue(detail({ email: null, name: null }));

    mount();

    expect(screen.getByText(USER_ID)).not.toBeNull();
  });

  it("surfaces the ban reason so a moderator can see why the account was locked", () => {
    getDetail.mockReturnValue(detail({ banned: true, banReason: "spam reports" }));

    mount();

    expect(screen.getByText("spam reports")).not.toBeNull();
  });

  it("lists the user's sessions with the origin they signed in from", () => {
    listSessions.mockReturnValue({
      data: {
        items: [
          {
            createdAt: new Date("2026-01-01T00:00:00Z"),
            expired: false,
            expiresAt: new Date("2026-02-01T00:00:00Z"),
            id: "0195a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5d",
            ipAddress: "203.0.113.7",
            userAgent: "Mozilla/5.0",
          },
        ],
      },
      isLoading: false,
    });

    mount();

    expect(screen.getByText(/203\.0\.113\.7/)).not.toBeNull();
  });
});
