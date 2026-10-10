import { describe, expect, it, vi } from "vitest";

const repoApiMock = vi.hoisted(() => ({
  getByName: vi.fn(),
  list: vi.fn(),
}));

const spinnerMock = vi.hoisted(() => ({
  withTaskSpinner: vi.fn(async (_label: string, task: () => Promise<unknown>) => task()),
}));

const promptMock = vi.hoisted(() => ({
  guardPrompt: vi.fn(async (input: unknown) => input),
}));

vi.mock("@/core/repo.api", () => ({
  repoApi: repoApiMock,
}));

vi.mock("@/ui/spinner", () => ({
  withTaskSpinner: spinnerMock.withTaskSpinner,
}));

vi.mock("./prompts", () => ({
  guardPrompt: promptMock.guardPrompt,
}));

import { parseRepoTarget, resolveRepository } from "./repo";

describe("parseRepoTarget", () => {
  it("accepts a valid owner/name target", () => {
    expect(parseRepoTarget("acme/backend")).toEqual({ name: "backend", owner: "acme" });
  });

  it("rejects malformed targets", () => {
    expect(parseRepoTarget("onlyone")).toBeNull();
    expect(parseRepoTarget("acme/")).toBeNull();
  });

  it("rejects a target with too many segments", () => {
    expect(parseRepoTarget("a/b/c")).toBeNull();
  });

  it("rejects a blank owner or name", () => {
    expect(parseRepoTarget("/backend")).toBeNull();
    expect(parseRepoTarget("   /backend")).toBeNull();
    expect(parseRepoTarget("acme/   ")).toBeNull();
    expect(parseRepoTarget("")).toBeNull();
  });

  it("trims surrounding whitespace on both halves", () => {
    expect(parseRepoTarget("  acme  /  backend  ")).toEqual({ name: "backend", owner: "acme" });
  });
});

describe("resolveRepository", () => {
  it("uses the explicit repo target directly", async () => {
    repoApiMock.getByName.mockResolvedValue({ id: "r-1", name: "backend", owner: "acme" });

    await expect(resolveRepository("acme/backend")).resolves.toMatchObject({
      name: "backend",
      owner: "acme",
      target: "acme/backend",
    });
  });

  it("prompts the user when no target was supplied and resolves the selected repo", async () => {
    repoApiMock.list.mockResolvedValue({
      items: [{ id: "r-2", language: "ts", name: "alerts", owner: "acme" }],
      meta: { totalCount: 1 },
    });
    promptMock.guardPrompt.mockResolvedValue("acme/alerts");
    repoApiMock.getByName.mockResolvedValue({
      id: "r-2",
      language: "ts",
      name: "alerts",
      owner: "acme",
    });

    await expect(resolveRepository()).resolves.toMatchObject({ target: "acme/alerts" });
    expect(repoApiMock.list).toHaveBeenCalled();
    expect(repoApiMock.getByName).toHaveBeenCalledWith("acme", "alerts");
  });

  it("returns null when the account has no repositories at all", async () => {
    repoApiMock.list.mockResolvedValue({ items: [], meta: { totalCount: 0 } });

    await expect(resolveRepository()).resolves.toBeNull();
    expect(repoApiMock.getByName).not.toHaveBeenCalled();
  });

  it("returns null when the requested repository does not exist on the server", async () => {
    repoApiMock.getByName.mockResolvedValue(null);

    await expect(resolveRepository("acme/missing")).resolves.toBeNull();
  });

  it("returns null for a malformed explicit target instead of calling the API", async () => {
    await expect(resolveRepository("just-a-name")).resolves.toBeNull();
    expect(repoApiMock.getByName).not.toHaveBeenCalled();
  });

  it("propagates a rejection from the API rather than swallowing it", async () => {
    repoApiMock.getByName.mockRejectedValue(new Error("network down"));

    await expect(resolveRepository("acme/backend")).rejects.toThrow("network down");
  });

  it("searches by keyword when the user picks the search entry", async () => {
    const items = Array.from({ length: 30 }, (_, index) => ({
      id: `r-${index}`,
      language: "ts",
      name: `svc-${index}`,
      owner: "acme",
    }));
    repoApiMock.list.mockResolvedValue({ items, meta: { totalCount: 30 } });
    promptMock.guardPrompt
      .mockResolvedValueOnce("__SEARCH__")
      .mockResolvedValueOnce("  backend  ")
      .mockResolvedValueOnce("acme/svc-3");
    repoApiMock.getByName.mockResolvedValue({ id: "r-3", name: "svc-3", owner: "acme" });

    await expect(resolveRepository()).resolves.toMatchObject({ target: "acme/svc-3" });
    expect(repoApiMock.list).toHaveBeenCalledWith({ limit: 25, search: "backend" });
  });

  it("returns null when the keyword search finds nothing", async () => {
    repoApiMock.list
      .mockResolvedValueOnce({
        items: [{ id: "r-1", name: "alerts", owner: "acme" }],
        meta: { totalCount: 40 },
      })
      .mockResolvedValueOnce({ items: [], meta: { totalCount: 0 } });
    promptMock.guardPrompt.mockResolvedValueOnce("__SEARCH__").mockResolvedValueOnce("zzz");

    await expect(resolveRepository()).resolves.toBeNull();
    expect(repoApiMock.getByName).not.toHaveBeenCalled();
  });
});
