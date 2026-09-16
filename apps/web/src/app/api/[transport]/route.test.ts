import { beforeEach, describe, expect, it, vi } from "vitest";
import * as z from "zod";

type ExecuteFn = (...args: Array<unknown>) => unknown;

type AuthFn = (request: Request, bearer: string | null) => Promise<Record<string, unknown>>;

const mocks = vi.hoisted(() => {
  const registeredTools: Array<{ execute: ExecuteFn; name: string }> = [];

  const registerTool = (name: string, _def: unknown, execute: ExecuteFn) => {
    registeredTools.push({ execute, name });
  };

  let capturedAuthFn: AuthFn | undefined;

  return {
    appLoggerDebug: vi.fn(),
    appLoggerError: vi.fn(),
    createMcpHandler: vi.fn((setupFn: (server: { registerTool: typeof registerTool }) => void) => {
      const server = { registerTool };
      setupFn(server);
      return "HANDLER";
    }),
    getAuthFn: () => capturedAuthFn,
    listRepositoriesExecute: vi.fn(),
    registeredTools,
    registerTool: vi.fn(registerTool),
    searchCodeExecute: vi.fn(),
    toolExecute: vi.fn(),
    withMcpAuth: vi.fn((_handler: unknown, authFn: AuthFn) => {
      capturedAuthFn = authFn;
      return "WITH_AUTH";
    }),
  };
});

vi.mock("mcp-handler", () => ({
  createMcpHandler: mocks.createMcpHandler,
  withMcpAuth: mocks.withMcpAuth,
}));

vi.mock("@/shared/config/env.server", () => ({
  APP_VERSION: "1.2.3",
}));

vi.mock("@/server/core/app-logger", () => ({
  appLogger: {
    debug: mocks.appLoggerDebug,
    error: mocks.appLoggerError,
  },
}));

vi.mock("@/server/modules/agent/agent.prompts", () => ({
  AGENT_SYSTEM_PROMPT: "PROMPT",
}));

vi.mock("@/server/modules/agent/agent.tools", () => ({
  getAgentTools: () => ({
    approvalOnlyTool: {
      description: "Approval required",
      execute: mocks.toolExecute,
      inputSchema: z.object({}),
      needsApproval: true,
    },
    badNonZodSchemaTool: {
      description: "Wrong schema type",
      execute: mocks.toolExecute,
      inputSchema: z.string(),
    },
    executeUndefinedTool: {
      description: "No execute function",
      execute: undefined,
      inputSchema: z.object({}),
    },
    listRepositories: {
      description: "List repositories",
      execute: mocks.listRepositoriesExecute,
      inputSchema: z.object({}),
    },
    searchCode: {
      description: "Search source code",
      execute: mocks.searchCodeExecute,
      inputSchema: z.object({ query: z.string() }),
    },
  }),
}));

vi.mock("@/server/utils/verify-and-use-api-key", () => ({
  verifyAndUseApiKey: mocks.toolExecute,
}));

function resetDefaultToolMocks(): void {
  mocks.appLoggerDebug.mockClear();
  mocks.appLoggerError.mockClear();
  mocks.createMcpHandler.mockClear();
  mocks.registerTool.mockClear();
  mocks.withMcpAuth.mockClear();

  mocks.registeredTools.length = 0;

  mocks.listRepositoriesExecute.mockReset().mockResolvedValue({ count: 0 });
  mocks.searchCodeExecute.mockReset().mockResolvedValue("SEARCH_RESULT");
  mocks.toolExecute.mockReset().mockResolvedValue(null);
}

describe("[transport] MCP route", () => {
  beforeEach(() => {
    vi.resetModules();
    resetDefaultToolMocks();
  });

  it("creates the MCP handler with instructions, server info, and config options", async () => {
    const mod = await import("./route");

    expect(mod.GET).toBe("WITH_AUTH");
    expect(mocks.createMcpHandler).toHaveBeenCalledWith(
      expect.any(Function),
      {
        instructions: "PROMPT",
        serverInfo: { name: "Doxynix", version: "1.2.3" },
      },
      { basePath: "/api", maxDuration: 60, verboseLogs: true },
    );
  });

  it("registers only tools with a function execute and a ZodObject schema", async () => {
    await import("./route");

    expect(mocks.registeredTools).toHaveLength(2);
    expect(mocks.registeredTools.map((tool) => tool.name)).toEqual(
      expect.arrayContaining(["searchCode", "listRepositories"]),
    );
  });

  it("logs and skips approval-required tools", async () => {
    await import("./route");

    expect(mocks.appLoggerDebug).toHaveBeenCalledWith({
      msg: "Skipping approval-required tool in MCP registration",
      tool: "approvalOnlyTool",
    });
  });

  it("wraps a registered tool execute and returns its string result", async () => {
    mocks.searchCodeExecute.mockResolvedValue("SEARCH_RESULT");

    await import("./route");

    const searchCode = mocks.registeredTools.find((tool) => tool.name === "searchCode");
    expect(searchCode).toBeDefined();

    const result = await searchCode?.execute({ query: "auth" });

    expect(mocks.searchCodeExecute).toHaveBeenCalledWith(
      { query: "auth" },
      { messages: [], toolCallId: expect.stringContaining("mcp-searchCode-") },
    );
    expect(result).toEqual({ content: [{ text: "SEARCH_RESULT", type: "text" }] });
  });

  it("serializes an object tool result with JSON.stringify", async () => {
    mocks.searchCodeExecute.mockResolvedValue({ ok: true });

    await import("./route");

    const searchCode = mocks.registeredTools.find((tool) => tool.name === "searchCode");
    expect(searchCode).toBeDefined();

    const result = await searchCode?.execute({ query: "auth" });

    expect(result).toEqual({ content: [{ text: JSON.stringify({ ok: true }), type: "text" }] });
  });

  it("returns an internal-error response and logs when a tool execution throws", async () => {
    mocks.listRepositoriesExecute.mockRejectedValue(new Error("db down"));

    await import("./route");

    const listRepositories = mocks.registeredTools.find((tool) => tool.name === "listRepositories");
    expect(listRepositories).toBeDefined();

    const result = await listRepositories?.execute({});

    expect(result).toEqual({
      content: [
        { text: "An internal server error occurred while executing this tool.", type: "text" },
      ],
      isError: true,
    });
    expect(mocks.appLoggerError).toHaveBeenCalledWith(
      expect.objectContaining({ msg: "MCP Tool execution failed", tool: "listRepositories" }),
    );
  });

  it("rejects authentication when no bearer token is provided", async () => {
    await import("./route");

    const authFn = mocks.getAuthFn();
    expect(authFn).toBeDefined();
    await expect(authFn?.(new Request("http://x"), null)).rejects.toThrow(
      "Unauthorized: Missing API Key.",
    );
  });

  it("rejects authentication when the API key is invalid or revoked", async () => {
    mocks.toolExecute.mockResolvedValue(null);

    await import("./route");

    const authFn = mocks.getAuthFn();
    expect(authFn).toBeDefined();
    await expect(authFn?.(new Request("http://x"), "bad-key")).rejects.toThrow(
      "Unauthorized: Invalid or revoked Doxynix API Key.",
    );
    expect(mocks.toolExecute).toHaveBeenCalledWith("bad-key");
  });

  it("resolves authentication to a client identity for a valid API key", async () => {
    mocks.toolExecute.mockResolvedValue({ userId: 42 });

    await import("./route");

    const authFn = mocks.getAuthFn();
    expect(authFn).toBeDefined();
    const result = await authFn?.(new Request("http://x"), "good-key");

    expect(result).toEqual({ clientId: "42", scopes: [], token: "good-key" });
    expect(mocks.toolExecute).toHaveBeenCalledWith("good-key");
  });

  it("wraps the handler with withMcpAuth and captures the auth callback", async () => {
    const mod = await import("./route");

    expect(mod.GET).toBe("WITH_AUTH");
    expect(mocks.withMcpAuth).toHaveBeenCalledTimes(1);
    expect(mocks.withMcpAuth).toHaveBeenCalledWith("HANDLER", expect.any(Function), {
      required: true,
    });
    expect(mocks.getAuthFn()).toBeDefined();
  });

  it("exports both GET and POST as the withMcpAuth handler", async () => {
    const mod = await import("./route");

    expect(mod.GET).toBe("WITH_AUTH");
    expect(mod.POST).toBe("WITH_AUTH");
  });
});
