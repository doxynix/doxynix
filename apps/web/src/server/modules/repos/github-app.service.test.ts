import { beforeEach, describe, expect, it, vi } from "vitest";

const paginate = vi.fn();
const getValidToken = vi.fn();

vi.mock("@/shared/config/env.server", () => ({ GITHUB_APP_ID: "12345" }));
vi.mock("@/server/core/github/github-access-token", () => ({
  githubTokenService: { getValidToken },
}));
vi.mock("@/server/core/github/github-client", () => ({
  getInstallationInfo: vi.fn(),
  getPublicClient: () => ({
    paginate,
    rest: {
      apps: { listInstallationsForAuthenticatedUser: "listInstallationsForAuthenticatedUser" },
    },
  }),
}));
vi.mock("@/server/core/realtime", () => ({
  realtimeService: { user: () => ({ publish: vi.fn() }) },
}));

const { githubAppService } = await import("./github-app.service");

const INSTALLATION = {
  account: { avatar_url: "https://a", id: 99, login: "acme", node_id: "n" },
  app_id: 12_345,
  html_url: "https://github.com/apps/x",
  id: 4242,
  id_hton: "4242",
  repository_selection: "selected",
  target_id: 99,
  target_type: "Organization",
};

function makeDb(existing: { id: bigint; workspaceId: string }[]) {
  const create = vi.fn().mockResolvedValue({});
  const findMany = vi.fn().mockResolvedValue(existing);
  const updateMany = vi.fn().mockResolvedValue({ count: 1 });
  return {
    create,
    db: { githubInstallation: { create, findMany, updateMany } },
    findMany,
    updateMany,
  };
}

describe("githubAppService.syncInstallations ownership", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getValidToken.mockResolvedValue("tok");
    paginate.mockResolvedValue([INSTALLATION]);
  });

  // The upsert used to be `where: { id }` with `update: { userId }`. A GitHub App
  // installation is one row per organisation, so whichever account synced last took it and the
  // first workspace silently lost its integration. `saveInstallation` already refused this;
  // the automatic path has to refuse it identically.
  it("scopes the update to an unclaimed row or one already owned by this user", async () => {
    const userId = "user-b";
    const workspaceId = "workspace-b";
    const { db, updateMany } = makeDb([{ id: 4242n, workspaceId }]);

    await githubAppService.syncInstallations(db as never, userId, workspaceId);

    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 4242n, workspaceId },
      }),
    );
    // The update must not carry userId, or it would still steal the row.
    expect(updateMany.mock.calls[0]?.[0]?.data).not.toHaveProperty("workspaceId");
  });

  it("does not touch an installation owned by another workspace", async () => {
    const { create, db, updateMany } = makeDb([{ id: 4242n, workspaceId: "workspace-a" }]);

    await githubAppService.syncInstallations(db as never, "user-b", "workspace-b");

    // Ownership is resolved from the batch read, so the row is skipped before any write is
    // attempted at all — not written with a predicate that happens not to match.
    expect(updateMany).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it("creates the row when no row exists for that installation", async () => {
    const { create, db } = makeDb([]);

    await githubAppService.syncInstallations(db as never, "user-c", "workspace-c");

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ id: 4242n, userId: "user-c", workspaceId: "workspace-c" }),
      }),
    );
  });

  it("reads the existing installations once, not once per installation", async () => {
    // `paginate` has no cap, so the loop length is whatever GitHub returns. One read up front
    // keeps the query count flat in the number of installations.
    const second = { ...INSTALLATION, id: 5252 };
    paginate.mockResolvedValue([INSTALLATION, second]);
    const { db, findMany } = makeDb([
      { id: 4242n, workspaceId: "workspace-b" },
      { id: 5252n, workspaceId: "workspace-b" },
    ]);

    await githubAppService.syncInstallations(db as never, "user-b", "workspace-b");

    expect(findMany).toHaveBeenCalledTimes(1);
    expect(findMany.mock.calls[0]?.[0]?.where?.id).toEqual({ in: [4242n, 5252n] });
  });
});
