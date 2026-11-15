process.env.RESEND_API_KEY ??= "re_test_auth_hooks";

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  accountFindFirst: vi.fn(),
  bannedEmailFindUnique: vi.fn(),
  userFindUnique: vi.fn(),
  userUpdate: vi.fn(),
}));

vi.mock("@/server/core/db", () => ({
  prisma: {
    account: { findFirst: mocks.accountFindFirst },
    bannedEmail: { findUnique: mocks.bannedEmailFindUnique },
    user: { findUnique: mocks.userFindUnique, update: mocks.userUpdate },
  },
}));

vi.mock("@/server/core/app-logger", () => ({
  appLogger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

const { auth } = await import("./index");

const USER_ID = "0195a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5d";

// The five profile columns the create hooks read; everything else on `User` is unused there.
const PROFILE_SELECT = { email: true, emailHash: true, id: true, image: true, name: true };

type Hooks = {
  account?: {
    create?: {
      after?: (account: Record<string, unknown>) => Promise<void>;
      before?: (account: Record<string, unknown>) => Promise<{ data: Record<string, unknown> }>;
    };
  };
  session?: {
    create?: {
      after?: (session: { userId: string }) => Promise<void>;
      before?: (session: { userId: string }) => Promise<{ data: unknown } | undefined>;
    };
  };
};

const hooks = (auth.options as unknown as { databaseHooks: Hooks }).databaseHooks;

function dbUser(overrides: Record<string, unknown> = {}) {
  return {
    email: "karen@example.com",
    emailHash: "hash-of-karen",
    id: USER_ID,
    image: "https://cdn/old.png",
    name: "karen",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.bannedEmailFindUnique.mockResolvedValue(null);
  mocks.userFindUnique.mockResolvedValue(null);
});

describe("account.create.before", () => {
  it("reads only the profile columns it copies onto the account", async () => {
    mocks.userFindUnique.mockResolvedValue(dbUser());

    const result = await hooks.account?.create?.before?.({
      image: null,
      name: null,
      providerId: "github",
      userId: USER_ID,
    });

    expect(mocks.userFindUnique).toHaveBeenCalledWith({
      select: PROFILE_SELECT,
      where: { id: USER_ID },
    });
    expect(result?.data).toMatchObject({
      email: "karen@example.com",
      emailHash: "hash-of-karen",
      image: "https://cdn/old.png",
    });
  });

  it("upgrades the placeholder name from the provider profile", async () => {
    mocks.userFindUnique.mockResolvedValue(dbUser());

    await hooks.account?.create?.before?.({
      name: "Karen Avakoff",
      providerId: "github",
      userId: USER_ID,
    });

    expect(mocks.userUpdate).toHaveBeenCalledWith({
      data: { name: "Karen Avakoff" },
      where: { id: USER_ID },
    });
  });
});

describe("session.create.before", () => {
  it("reads only the profile columns the ban check and the OAuth sync need", async () => {
    mocks.userFindUnique.mockResolvedValue(dbUser());
    mocks.accountFindFirst.mockResolvedValue(null);

    await hooks.session?.create?.before?.({ userId: USER_ID });

    expect(mocks.userFindUnique).toHaveBeenCalledWith({
      select: PROFILE_SELECT,
      where: { id: USER_ID },
    });
  });

  it("syncs the avatar and the name from the newest OAuth account", async () => {
    mocks.userFindUnique.mockResolvedValue(dbUser());
    mocks.accountFindFirst.mockResolvedValue({
      image: "https://cdn/new.png",
      name: "Karen Avakoff",
      providerId: "github",
    });

    await hooks.session?.create?.before?.({ userId: USER_ID });

    expect(mocks.userUpdate).toHaveBeenCalledWith({
      data: { image: "https://cdn/new.png", name: "Karen Avakoff" },
      where: { id: USER_ID },
    });
  });

  it("rejects a banned email without touching the account row", async () => {
    mocks.userFindUnique.mockResolvedValue(dbUser());
    mocks.bannedEmailFindUnique.mockResolvedValue({ id: "ban-1" });

    await expect(hooks.session?.create?.before?.({ userId: USER_ID })).rejects.toMatchObject({
      body: { message: "EmailBanned" },
    });
    expect(mocks.accountFindFirst).not.toHaveBeenCalled();
  });
});

describe("session.create.after", () => {
  it("still reads the three columns the sign-in log needs", async () => {
    mocks.userFindUnique.mockResolvedValue({
      createdAt: new Date(),
      id: USER_ID,
      role: "USER",
    });

    await hooks.session?.create?.after?.({ userId: USER_ID });

    expect(mocks.userFindUnique).toHaveBeenCalledWith({
      select: { createdAt: true, id: true, role: true },
      where: { id: USER_ID },
    });
  });
});
