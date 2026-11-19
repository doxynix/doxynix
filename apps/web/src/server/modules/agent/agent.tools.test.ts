import { MAX_PAGE_SIZE } from "@doxynix/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { apiMock, keysMock } = vi.hoisted(() => ({
  apiMock: vi.fn(),
  keysMock: { list: vi.fn(), listArchived: vi.fn(), revoke: vi.fn() },
}));

vi.mock("@/server/core/trpc/server", () => ({ api: apiMock }));

import { getAgentTools } from "./agent.tools";

const KEY_ID = "0195a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b";

function page<TItem>(items: TItem[], nextCursor?: string) {
  return { items, meta: { hasNextPage: nextCursor != null, nextCursor } };
}

describe("listApiKeys", () => {
  beforeEach(() => {
    apiMock.mockResolvedValue({ apikey: keysMock });
    keysMock.list.mockResolvedValue(page([{ id: KEY_ID, name: "ci" }]));
    keysMock.listArchived.mockResolvedValue(page([{ id: "dead", name: "old" }]));
  });

  it("reads both lists and follows their cursors", async () => {
    keysMock.list
      .mockResolvedValueOnce(page([{ id: KEY_ID, name: "ci" }], "cursor-1"))
      .mockResolvedValueOnce(page([{ id: "key-2", name: "ci-2" }]));
    keysMock.listArchived
      .mockResolvedValueOnce(page([{ id: "dead", name: "old" }], "cursor-2"))
      .mockResolvedValueOnce(page([{ id: "dead-2", name: "older" }]));

    const result = await getAgentTools().listApiKeys.execute({}, {} as never);

    expect(keysMock.list).toHaveBeenNthCalledWith(1, {
      cursor: undefined,
      limit: MAX_PAGE_SIZE,
    });
    expect(keysMock.list).toHaveBeenNthCalledWith(2, {
      cursor: "cursor-1",
      limit: MAX_PAGE_SIZE,
    });
    expect(keysMock.listArchived).toHaveBeenNthCalledWith(2, {
      cursor: "cursor-2",
      limit: MAX_PAGE_SIZE,
    });
    expect(result).toStrictEqual({
      active: [
        { id: KEY_ID, name: "ci" },
        { id: "key-2", name: "ci-2" },
      ],
      archived: [
        { id: "dead", name: "old" },
        { id: "dead-2", name: "older" },
      ],
    });
  });
});

describe("revokeApiKey", () => {
  beforeEach(() => {
    apiMock.mockResolvedValue({ apikey: keysMock });
    keysMock.list.mockResolvedValue(page([{ id: KEY_ID, name: "CI deploy" }]));
    keysMock.revoke.mockResolvedValue({ success: true });
    keysMock.listArchived.mockClear();
  });

  it("revokes by name from the active keys only", async () => {
    const result = await getAgentTools().revokeApiKey.execute(
      { keyIdentifier: "ci deploy" },
      {} as never,
    );

    expect(keysMock.list).toHaveBeenCalledWith({ cursor: undefined, limit: MAX_PAGE_SIZE });
    expect(keysMock.listArchived).not.toHaveBeenCalled();
    expect(keysMock.revoke).toHaveBeenCalledWith({ id: KEY_ID });
    expect(result).toStrictEqual({ success: true });
  });

  it("finds a match on a later active page", async () => {
    keysMock.list
      .mockResolvedValueOnce(page([{ id: "other", name: "other" }], "cursor-1"))
      .mockResolvedValueOnce(page([{ id: KEY_ID, name: "CI deploy" }]));

    const result = await getAgentTools().revokeApiKey.execute(
      { keyIdentifier: "ci deploy" },
      {} as never,
    );

    expect(keysMock.revoke).toHaveBeenCalledWith({ id: KEY_ID });
    expect(result).toStrictEqual({ success: true });
  });

  it("reports an active-key miss instead of revoking an archived key", async () => {
    keysMock.list.mockResolvedValue(page([]));

    const result = await getAgentTools().revokeApiKey.execute(
      { keyIdentifier: "old" },
      {} as never,
    );

    expect(result).toStrictEqual({
      error: 'No active API key found with name "old".',
      success: false,
    });
    expect(keysMock.revoke).not.toHaveBeenCalled();
  });
});
