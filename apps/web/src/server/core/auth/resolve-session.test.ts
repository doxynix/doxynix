import { ApiKeyScope } from "@doxynix/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({
  getSession: vi.fn(),
}));

const verifyAndUseApiKey = vi.hoisted(() => vi.fn());

vi.mock("@/server/core/auth", () => ({ auth: { api: auth } }));
vi.mock("@/server/core/auth/verify-api-key", () => ({ verifyAndUseApiKey }));

import { resolveRequestUserId } from "./resolve-session";

const bearer = (token: string) => new Headers({ authorization: `Bearer ${token}` });

const keyRecord = (scopes: string[]) => ({ scopes, user: { id: "user-1" } });

beforeEach(() => {
  vi.clearAllMocks();
  auth.getSession.mockResolvedValue(null);
  verifyAndUseApiKey.mockResolvedValue(null);
});

describe("resolveRequestUserId", () => {
  it("returns the api key owner for a valid bearer token", async () => {
    verifyAndUseApiKey.mockResolvedValue(keyRecord([ApiKeyScope.FULL]));

    await expect(resolveRequestUserId(bearer("dxnx_valid"), ApiKeyScope.CLI)).resolves.toBe(
      "user-1",
    );
    expect(auth.getSession).not.toHaveBeenCalled();
  });

  it("falls back to the cookie session when the bearer token is rejected", async () => {
    verifyAndUseApiKey.mockResolvedValue(null);
    auth.getSession.mockResolvedValue({ user: { id: "user-2" } });

    await expect(resolveRequestUserId(bearer("dxnx_stale"), ApiKeyScope.CLI)).resolves.toBe(
      "user-2",
    );
  });

  it("returns null when no credential is present", async () => {
    await expect(resolveRequestUserId(new Headers(), ApiKeyScope.CLI)).resolves.toBeNull();
    expect(verifyAndUseApiKey).not.toHaveBeenCalled();
  });

  it("ignores an authorization header that is not a bearer scheme", async () => {
    auth.getSession.mockResolvedValue(null);

    await expect(
      resolveRequestUserId(
        new Headers({ authorization: `Basic ${btoa("user:pass")}` }),
        ApiKeyScope.CLI,
      ),
    ).resolves.toBeNull();
    expect(verifyAndUseApiKey).not.toHaveBeenCalled();
  });

  it("denies an MCP-only key on a CLI surface without falling back to the cookie session", async () => {
    verifyAndUseApiKey.mockResolvedValue(keyRecord([ApiKeyScope.MCP]));

    await expect(resolveRequestUserId(bearer("dxnx_mcp"), ApiKeyScope.CLI)).resolves.toBeNull();
    expect(auth.getSession).not.toHaveBeenCalled();
  });

  it("grants a CLI key access to a CLI surface", async () => {
    verifyAndUseApiKey.mockResolvedValue(keyRecord([ApiKeyScope.CLI]));

    await expect(resolveRequestUserId(bearer("dxnx_cli"), ApiKeyScope.CLI)).resolves.toBe("user-1");
  });

  it("treats a key with no scopes as full access", async () => {
    verifyAndUseApiKey.mockResolvedValue(keyRecord([]));

    await expect(resolveRequestUserId(bearer("dxnx_legacy"), ApiKeyScope.MCP)).resolves.toBe(
      "user-1",
    );
  });
});
