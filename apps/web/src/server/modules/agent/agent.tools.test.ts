import { MAX_PAGE_SIZE } from "@doxynix/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { apiMock, keysMock } = vi.hoisted(() => ({
  apiMock: vi.fn(),
  keysMock: { list: vi.fn(), listArchived: vi.fn(), revoke: vi.fn() },
}));

vi.mock("@/server/core/trpc/server", () => ({ api: apiMock }));

import { getAgentTools } from "./agent.tools";

const KEY_ID = "0195a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b";

describe("listApiKeys", () => {
  beforeEach(() => {
    apiMock.mockResolvedValue({ apikey: keysMock });
    keysMock.list.mockResolvedValue({ items: [{ id: KEY_ID, name: "ci" }], meta: {} });
    keysMock.listArchived.mockResolvedValue({ items: [{ id: "dead", name: "old" }] });
  });

  it("reads the active page and the archived list separately", async () => {
    const result = await getAgentTools().listApiKeys.execute({}, {} as never);

    expect(keysMock.list).toHaveBeenCalledWith({ limit: MAX_PAGE_SIZE });
    expect(keysMock.listArchived).toHaveBeenCalledTimes(1);
    expect(result).toStrictEqual({
      active: [{ id: KEY_ID, name: "ci" }],
      archived: [{ id: "dead", name: "old" }],
    });
  });
});

describe("revokeApiKey", () => {
  beforeEach(() => {
    apiMock.mockResolvedValue({ apikey: keysMock });
    keysMock.list.mockResolvedValue({ items: [{ id: KEY_ID, name: "CI deploy" }], meta: {} });
    keysMock.revoke.mockResolvedValue({ success: true });
    keysMock.listArchived.mockClear();
  });

  it("revokes by name from the active keys only", async () => {
    const result = await getAgentTools().revokeApiKey.execute(
      { keyIdentifier: "ci deploy" },
      {} as never,
    );

    expect(keysMock.list).toHaveBeenCalledWith({ limit: MAX_PAGE_SIZE });
    expect(keysMock.listArchived).not.toHaveBeenCalled();
    expect(keysMock.revoke).toHaveBeenCalledWith({ id: KEY_ID });
    expect(result).toStrictEqual({ success: true });
  });

  it("reports an active-key miss instead of revoking an archived key", async () => {
    keysMock.list.mockResolvedValue({ items: [], meta: { hasNextPage: false } });

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
