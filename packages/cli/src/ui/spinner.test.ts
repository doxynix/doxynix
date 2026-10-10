import { afterEach, describe, expect, it, vi } from "vitest";

const oraMock = vi.hoisted(() => vi.fn());

vi.mock("ora", () => ({
  default: oraMock,
}));

import { withTaskSpinner } from "./spinner";

afterEach(() => {
  vi.clearAllMocks();
});

describe("withTaskSpinner", () => {
  it("returns the task result without creating a spinner when silent mode is enabled", async () => {
    const task = vi.fn(async () => "done");

    await expect(withTaskSpinner({ silent: true, start: "Loading..." }, task)).resolves.toBe(
      "done",
    );
    expect(oraMock).not.toHaveBeenCalled();
  });

  it("starts and persists the spinner on successful completion", async () => {
    const spinner = {
      start: vi.fn(),
      stop: vi.fn(),
      stopAndPersist: vi.fn(),
      text: "",
    };
    oraMock.mockReturnValue(spinner);

    const task = vi.fn(async (update: (msg: string) => void) => {
      update("Still working");
      return "done";
    });

    await expect(withTaskSpinner("Loading...", task)).resolves.toBe("done");
    expect(spinner.start).toHaveBeenCalledTimes(1);
    expect(spinner.stopAndPersist).toHaveBeenCalledTimes(1);
    expect(spinner.text).toBe("Still working");
  });
});
