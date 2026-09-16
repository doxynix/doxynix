import type { RepositoryEvent } from "@octokit/webhooks-types";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  appLogger: { debug: vi.fn(), error: vi.fn(), info: vi.fn(), warn: vi.fn() },
  prisma: { repo: { deleteMany: vi.fn() } },
  syncRepoMetadata: vi.fn(),
}));

vi.mock("@/server/core/app-logger", () => ({ appLogger: mocks.appLogger }));
vi.mock("@/server/core/db", () => ({ prisma: mocks.prisma }));
vi.mock("./sync-repo-metadata", () => ({ syncRepoMetadata: mocks.syncRepoMetadata }));

import { handleRepositoryEvent } from "./repository-webhook-handler";

function makeRepositoryEvent(action: string, repositoryId = 123): RepositoryEvent {
  return {
    action,
    installation: { id: 1 } as unknown as NonNullable<RepositoryEvent["installation"]>,
    repository: {
      default_branch: "main",
      full_name: "owner/repo",
      html_url: "https://github.com/owner/repo",
      id: repositoryId,
      name: "repo",
      node_id: "n",
      owner: {
        avatar_url: null,
        email: null,
        events_url: "",
        followers_url: "",
        following_url: "",
        gists_url: "",
        gravatar_id: null,
        html_url: "",
        id: 1,
        login: "owner",
        node_id: "",
        organizations_url: "",
        received_events_url: "",
        repos_url: "",
        site_admin: false,
        starred_url: "",
        subscriptions_url: "",
        type: "User",
        url: "",
      },
      private: false,
    } as unknown as RepositoryEvent["repository"],
  } as unknown as RepositoryEvent;
}

describe("handleRepositoryEvent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("action 'deleted' — удаляет из БД и логирует результат", async () => {
    mocks.prisma.repo.deleteMany.mockResolvedValue({ count: 2 });
    const event = makeRepositoryEvent("deleted");

    const result = await handleRepositoryEvent(event);

    expect(result).toBeUndefined();
    expect(mocks.prisma.repo.deleteMany).toHaveBeenCalledWith({
      where: { githubId: 123 },
    });
    expect(mocks.appLogger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        affectedRows: 2,
        githubId: 123,
        msg: "repository_deleted_in_db",
      }),
    );
    expect(mocks.syncRepoMetadata).not.toHaveBeenCalled();
  });

  it("action 'archived' — вызывает syncRepoMetadata", async () => {
    mocks.syncRepoMetadata.mockResolvedValue(undefined);
    const event = makeRepositoryEvent("archived");

    await handleRepositoryEvent(event);

    expect(mocks.syncRepoMetadata).toHaveBeenCalledWith(event.repository);
    expect(mocks.appLogger.info).toHaveBeenCalledWith(
      expect.objectContaining({ msg: "repository_state_updated" }),
    );
    expect(mocks.prisma.repo.deleteMany).not.toHaveBeenCalled();
  });

  it("action 'renamed' — вызывает syncRepoMetadata", async () => {
    mocks.syncRepoMetadata.mockResolvedValue(undefined);
    const event = makeRepositoryEvent("renamed");

    await handleRepositoryEvent(event);

    expect(mocks.syncRepoMetadata).toHaveBeenCalledWith(event.repository);
  });

  it("action 'created' — не вызывает syncRepoMetadata", async () => {
    const event = makeRepositoryEvent("created");

    await handleRepositoryEvent(event);

    expect(mocks.syncRepoMetadata).not.toHaveBeenCalled();
    expect(mocks.prisma.repo.deleteMany).not.toHaveBeenCalled();
  });

  it("syncRepoMetadata выбрасывает ошибку — прокидывает и логирует", async () => {
    mocks.syncRepoMetadata.mockRejectedValue(new Error("sync failed"));
    const event = makeRepositoryEvent("renamed");

    await expect(handleRepositoryEvent(event)).rejects.toThrow("sync failed");
    expect(mocks.appLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({ msg: "repository_webhook_error" }),
    );
  });

  it("deleteMany выбрасывает ошибку — прокидывает и логирует", async () => {
    const error = new Error("db failure");
    mocks.prisma.repo.deleteMany.mockRejectedValue(error);
    const event = makeRepositoryEvent("deleted");

    await expect(handleRepositoryEvent(event)).rejects.toThrow("db failure");
    expect(mocks.appLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({ msg: "repository_webhook_error" }),
    );
  });
});
