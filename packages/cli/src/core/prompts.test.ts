import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

import { stripAnsi } from "@/ui/formatters";

import {
  confirmOrAbort,
  guardPrompt,
  isInteractiveSession,
  NonInteractiveError,
  PromptCancelledError,
  resolveEntityOrPick,
} from "./prompts";

const originalStdinIsTTY = process.stdin.isTTY;
const originalStdoutIsTTY = process.stdout.isTTY;

beforeEach(() => {
  // The vitest worker has no controlling terminal, so force one for the
  // interactive-path tests; the non-interactive tests override it per test.
  process.stdin.isTTY = true;
  process.stdout.isTTY = true;
});

afterEach(() => {
  process.stdin.isTTY = originalStdinIsTTY;
  process.stdout.isTTY = originalStdoutIsTTY;
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
    expect(prompts.outro.mock.calls[0]?.[0]).toBeDefined();
    expect(stripAnsi(prompts.outro.mock.calls[0]?.[0] ?? "")).toBe("No items found.");
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
    // CI=true makes confirmOrAbort auto-confirm without prompting, so the
    // rejection path is only reachable when it is unset.
    const ci = process.env.CI;
    process.env.CI = "";
    prompts.confirm.mockResolvedValue(false);

    await expect(confirmOrAbort("Delete all?")).resolves.toBe(false);
    expect(prompts.outro).toHaveBeenCalled();

    if (ci === undefined) {
      delete process.env.CI;
    } else {
      process.env.CI = ci;
    }
  });
});

describe("non-interactive sessions", () => {
  const originalIsTTY = process.stdin.isTTY;

  afterEach(() => {
    process.stdin.isTTY = originalIsTTY;
    vi.clearAllMocks();
  });

  it("isInteractiveSession is false when stdin is not a TTY", () => {
    process.stdin.isTTY = false;

    expect(isInteractiveSession()).toBe(false);
  });

  it("guardPrompt refuses to prompt when stdin is not a TTY", async () => {
    process.stdin.isTTY = false;
    prompts.select.mockReturnValue(new Promise(() => {}));

    await expect(
      guardPrompt(prompts.select({ message: "Pick", options: [] }) as never, "cancelled"),
    ).rejects.toBeInstanceOf(NonInteractiveError);
    expect(prompts.outro).not.toHaveBeenCalled();
  });

  it("confirmOrAbort throws with a --yes hint instead of hanging", async () => {
    process.stdin.isTTY = false;
    const ci = process.env.CI;
    process.env.CI = "";

    await expect(
      confirmOrAbort({ danger: true, message: "Delete everything?" }),
    ).rejects.toBeInstanceOf(NonInteractiveError);

    expect(prompts.confirm).not.toHaveBeenCalled();

    if (ci === undefined) {
      delete process.env.CI;
    } else {
      process.env.CI = ci;
    }
  });
});
