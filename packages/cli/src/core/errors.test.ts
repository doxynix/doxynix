import { TRPCClientError } from "@trpc/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { outro } = vi.hoisted(() => ({ outro: vi.fn() }));

vi.mock("@clack/prompts", () => ({ outro }));

import { handleCliError } from "./errors";
import { PromptCancelledError } from "./prompts";

let originalArgv: string[];
let stdout: string[];
let exitCodes: (number | undefined)[];

// tRPC 11 reads the payload from `result.error.data`; a bare `data` option is
// silently ignored and leaves `error.data` undefined.
function trpcError(message: string, code?: string): TRPCClientError<never> {
  const errorShape = {
    code: "BAD_REQUEST",
    data: code === undefined ? null : { code },
    message,
  };

  return new TRPCClientError<never>(message, {
    result: { error: errorShape } as never,
  });
}

beforeEach(() => {
  originalArgv = [...process.argv];
  process.argv = ["node", "dxnx"];
  outro.mockClear();
  stdout = [];
  exitCodes = [];
  vi.spyOn(process.stdout, "write").mockImplementation((chunk: unknown) => {
    stdout.push(String(chunk));
    return true;
  });
  vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
    exitCodes.push(code);
    // The real process.exit never returns; emulate that so handleCliError cannot
    // fall through into later branches it would never reach in production.
    throw new ExitSignal(code ?? 0);
  }) as never);
});

afterEach(() => {
  process.argv = originalArgv;
  vi.restoreAllMocks();
});

class ExitSignal extends Error {
  readonly code: number;
  constructor(code: number) {
    super(`exit:${code}`);
    this.name = "ExitSignal";
    this.code = code;
  }
}

function run(error: unknown): { code: number; outroText: string; stdout: string } {
  let code = -1;
  try {
    handleCliError(error);
  } catch (error) {
    if (error instanceof ExitSignal) {
      code = error.code;
    } else {
      throw error;
    }
  }
  return { code, outroText: String(outro.mock.calls.at(-1)?.[0] ?? ""), stdout: stdout.join("") };
}

describe("handleCliError", () => {
  it("exits 0 silently when the user cancels a prompt", () => {
    const result = run(new PromptCancelledError("cancelled"));

    expect(result.code).toBe(0);
    expect(result.outroText).toBe("");
  });

  describe("json mode", () => {
    beforeEach(() => {
      process.argv = ["node", "dxnx", "--json"];
    });

    it("emits a JSON envelope carrying the tRPC error code", () => {
      const result = run(trpcError("Unauthorized", "UNAUTHORIZED"));

      expect(result.code).toBe(1);
      expect(JSON.parse(result.stdout)).toEqual({
        code: "UNAUTHORIZED",
        error: "Unauthorized",
        success: false,
      });
    });

    it("falls back to API_ERROR when the error carries no code", () => {
      expect(JSON.parse(run(trpcError("boom")).stdout).code).toBe("API_ERROR");
    });

    it("wraps a plain Error, not only tRPC errors", () => {
      expect(JSON.parse(run(new Error("plain failure")).stdout)).toEqual({
        code: "ERROR",
        error: "plain failure",
        success: false,
      });
    });

    it("wraps a non-Error throwable instead of crashing", () => {
      expect(JSON.parse(run("just a string").stdout)).toMatchObject({
        error: "just a string",
        success: false,
      });
    });

    it("prefers the JSON envelope over the human-readable message", () => {
      const result = run(trpcError("Unauthorized", "UNAUTHORIZED"));

      expect(result.outroText).toBe("");
      expect(result.stdout).toContain("UNAUTHORIZED");
    });
  });

  describe("human-readable mode", () => {
    it("points an unauthorized user at dxnx login", () => {
      const result = run(trpcError("Unauthorized", "UNAUTHORIZED"));

      expect(result.code).toBe(1);
      expect(result.outroText).toContain("Authorization failed");
      expect(result.outroText).toContain("dxnx login");
    });

    it("appends the server message when it adds information", () => {
      expect(run(trpcError("Token expired", "UNAUTHORIZED")).outroText).toContain("Token expired");
    });

    it("does not echo the bare UNAUTHORIZED code back as the message", () => {
      const result = run(trpcError("UNAUTHORIZED", "UNAUTHORIZED"));

      expect(result.outroText).not.toContain("Authorization failed: UNAUTHORIZED");
    });

    it("suggests starting the server when the tRPC transport cannot connect", () => {
      const result = run(trpcError("Unable to connect"));

      expect(result.outroText).toContain("Could not connect");
      expect(result.outroText).toContain("DOXYNIX_API_URL");
    });

    it("treats 'fetch failed' as an unreachable server", () => {
      expect(run(trpcError("fetch failed")).outroText).toContain("Could not connect");
    });

    it("prefixes other tRPC failures as API Error and keeps the message", () => {
      const result = run(trpcError("Something broke", "BAD_REQUEST"));

      expect(result.outroText).toContain("API Error");
      expect(result.outroText).toContain("Something broke");
    });

    it("reports ECONNREFUSED on a plain Error as unreachable", () => {
      const result = run(new Error("connect ECONNREFUSED 127.0.0.1:3000"));

      expect(result.outroText).toContain("unreachable");
      expect(result.outroText).toContain("DOXYNIX_API_URL");
    });

    it("reports an ordinary Error without claiming the server is down", () => {
      const result = run(new Error("ordinary bug"));

      expect(result.code).toBe(1);
      expect(result.outroText).toContain("ordinary bug");
      expect(result.outroText).not.toContain("unreachable");
    });

    it("handles a throwable that is neither Error nor tRPC error", () => {
      const result = run({ nope: true });

      expect(result.code).toBe(1);
      expect(result.outroText).toContain("unexpected error");
    });

    it("stays silent on stdout so piping is not corrupted", () => {
      expect(run(trpcError("Unauthorized", "UNAUTHORIZED")).stdout).toBe("");
    });
  });
});
