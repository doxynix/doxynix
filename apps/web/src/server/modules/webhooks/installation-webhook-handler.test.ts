import type { InstallationEvent } from "@octokit/webhooks-types";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  appLogger: { debug: vi.fn(), error: vi.fn(), info: vi.fn(), warn: vi.fn() },
  prisma: { githubInstallation: { deleteMany: vi.fn(), updateMany: vi.fn(), upsert: vi.fn() } },
}));

vi.mock("@/server/core/app-logger", () => ({ appLogger: mocks.appLogger }));
vi.mock("@/server/core/db", () => ({ prisma: mocks.prisma }));

import { handleInstallationEvent } from "./installation-webhook-handler";

function makeInstallationEvent(
  action: string,
  overrides: Record<string, unknown> = {},
): InstallationEvent {
  return {
    action,
    installation: {
      account: {
        avatar_url: "https://a/avatar.png",
        id: 42,
        login: "octocat",
        node_id: "n",
        type: "User",
      },
      app_id: 12_345,
      app_slug: "doxynix",
      created_at: "2026-01-01T00:00:00Z",
      has_multiple_single_files: false,
      html_url: "https://github.com/apps/doxynix/installations/999",
      id: 999,
      installed_at: "2026-01-01T00:00:00Z",
      permissions: {},
      repositories_url: "https://api.github.com/installation/repositories",
      repository_selection: "selected",
      single_file_name: null,
      suspended_at: null,
      suspended_by: null,
      target_id: 42,
      target_type: "User",
      updated_at: "2026-01-01T00:00:00Z",
      ...overrides,
    } as unknown as InstallationEvent["installation"],
  } as unknown as InstallationEvent;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("handleInstallationEvent", () => {
  it("calls upsert on created with correct fields", async () => {
    mocks.prisma.githubInstallation.upsert.mockResolvedValue({});
    const payload = makeInstallationEvent("created");

    await handleInstallationEvent(payload);

    expect(mocks.prisma.githubInstallation.upsert).toHaveBeenCalledWith({
      create: {
        accountAvatar: "https://a/avatar.png",
        accountLogin: "octocat",
        appId: 12_345,
        htmlUrl: "https://github.com/apps/doxynix/installations/999",
        id: 999n,
        repositorySelection: "SELECTED",
        targetId: 42n,
        targetType: "USER",
        userId: null,
      },
      update: {
        accountAvatar: "https://a/avatar.png",
        accountLogin: "octocat",
        htmlUrl: "https://github.com/apps/doxynix/installations/999",
        isSuspended: false,
        repositorySelection: "SELECTED",
      },
      where: { id: 999n },
    });
    expect(mocks.appLogger.info).toHaveBeenCalledWith(
      expect.objectContaining({ msg: "GitHub installation created via webhook" }),
    );
  });

  it("calls deleteMany on deleted", async () => {
    mocks.prisma.githubInstallation.deleteMany.mockResolvedValue({ count: 1 });
    const payload = makeInstallationEvent("deleted");

    await handleInstallationEvent(payload);

    expect(mocks.prisma.githubInstallation.deleteMany).toHaveBeenCalledWith({
      where: { id: 999n },
    });
    expect(mocks.appLogger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        affectedRows: 1,
        msg: "GitHub installation deleted via webhook",
      }),
    );
  });

  it("calls updateMany with isSuspended true on suspend", async () => {
    mocks.prisma.githubInstallation.updateMany.mockResolvedValue({ count: 1 });
    const payload = makeInstallationEvent("suspend");

    await handleInstallationEvent(payload);

    expect(mocks.prisma.githubInstallation.updateMany).toHaveBeenCalledWith({
      data: { isSuspended: true },
      where: { id: 999n },
    });
    expect(mocks.appLogger.info).toHaveBeenCalledWith(
      expect.objectContaining({ msg: "GitHub installation suspended" }),
    );
  });

  it("calls updateMany with isSuspended false on unsuspend", async () => {
    mocks.prisma.githubInstallation.updateMany.mockResolvedValue({ count: 1 });
    const payload = makeInstallationEvent("unsuspend");

    await handleInstallationEvent(payload);

    expect(mocks.prisma.githubInstallation.updateMany).toHaveBeenCalledWith({
      data: { isSuspended: false },
      where: { id: 999n },
    });
    expect(mocks.appLogger.info).toHaveBeenCalledWith(
      expect.objectContaining({ msg: "GitHub installation unsuspended" }),
    );
  });

  it("only logs on new_permissions_accepted with no prisma calls", async () => {
    const payload = makeInstallationEvent("new_permissions_accepted");

    await handleInstallationEvent(payload);

    expect(mocks.appLogger.info).toHaveBeenCalledWith(
      expect.objectContaining({ msg: "GitHub App permissions updated by user" }),
    );
    expect(mocks.prisma.githubInstallation.upsert).not.toHaveBeenCalled();
    expect(mocks.prisma.githubInstallation.deleteMany).not.toHaveBeenCalled();
    expect(mocks.prisma.githubInstallation.updateMany).not.toHaveBeenCalled();
  });

  it("throws and logs error when upsert fails", async () => {
    mocks.prisma.githubInstallation.upsert.mockRejectedValue(new Error("db"));
    const payload = makeInstallationEvent("created");

    await expect(handleInstallationEvent(payload)).rejects.toThrow("db");
    expect(mocks.appLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({ msg: "Webhook DB Processing Error" }),
    );
  });
});
