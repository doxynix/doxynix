import { afterEach, describe, expect, it, vi } from "vitest";

const prompts = vi.hoisted(() => {
  const CANCEL_SYMBOL = Symbol("cancel");

  return {
    CANCEL_SYMBOL,
    cancel: vi.fn(),
    confirm: vi.fn(),
    isCancel: vi.fn((value: unknown) => value === CANCEL_SYMBOL),
    outro: vi.fn(),
    select: vi.fn(),
    text: vi.fn(),
  };
});

vi.mock("@clack/prompts", () => ({
  CANCEL_SYMBOL: prompts.CANCEL_SYMBOL,
  cancel: prompts.cancel,
  confirm: prompts.confirm,
  isCancel: prompts.isCancel,
  outro: prompts.outro,
  select: prompts.select,
  text: prompts.text,
}));

import { confirmOrAbort, guardPrompt, PromptCancelledError, resolveEntityOrPick } from "./prompts";

afterEach(() => {
  vi.clearAllMocks();
});

describe("guardPrompt", () => {
  it("throws with a prompt-cancelled error when the prompt is cancelled", async () => {
    await expect(
      guardPrompt(Promise.resolve(prompts.CANCEL_SYMBOL), "User cancelled."),
    ).rejects.toBeInstanceOf(PromptCancelledError);
    expect(prompts.cancel).toHaveBeenCalledWith("User cancelled.");
  });

  it("returns the user selection for a non-cancelled prompt", async () => {
    await expect(guardPrompt(Promise.resolve("ok"), "Stop")).resolves.toBe("ok");
  });
});

describe("resolveEntityOrPick", () => {
  it("accepts a UUID directly without asking the user", async () => {
    const id = "11111111-1111-4111-8111-111111111111";

    await expect(
      resolveEntityOrPick({
        fetchItems: async () => [{ id: "22222222-2222-4222-8222-222222222222" }],
        getLabel: (item) => item.id,
        idArg: id,
        selectMessage: "Pick one",
      }),
    ).resolves.toBe(id);
  });

  it("returns null and prints a message when no items exist", async () => {
    await expect(
      resolveEntityOrPick<{ id: string }>({
        emptyMessage: "No items found.",
        fetchItems: async () => [],
        getLabel: (item) => item.id,
        selectMessage: "Pick one",
      }),
    ).resolves.toBeNull();
    expect(prompts.outro).toHaveBeenCalledWith("No items found.");
  });

  it("matches a partial identifier when a target is provided", async () => {
    const id = "33333333-3333-4333-8333-333333333333";

    await expect(
      resolveEntityOrPick({
        fetchItems: async () => [{ id }],
        getLabel: (item) => item.id,
        idArg: "33333333-3333",
        selectMessage: "Pick one",
      }),
    ).resolves.toBe(id);
  });
});

describe("confirmOrAbort", () => {
  it("auto-confirms in force mode without invoking the prompt", async () => {
    prompts.confirm.mockResolvedValue(true);

    await expect(confirmOrAbort({ force: true, message: "Delete all?" })).resolves.toBe(true);
    expect(prompts.confirm).not.toHaveBeenCalled();
  });

  it("returns false when the confirmation prompt is rejected", async () => {
    prompts.confirm.mockResolvedValue(false);

    await expect(confirmOrAbort("Delete all?")).resolves.toBe(false);
    expect(prompts.outro).toHaveBeenCalled();
  });
});
