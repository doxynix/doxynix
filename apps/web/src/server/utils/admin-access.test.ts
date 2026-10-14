import type { TRPCError } from "@trpc/server";
import { describe, expect, it } from "vitest";

import { assertAdminSecondFactor, assertAdminTotpCode, assertNotBanned } from "./admin-access";

const STRONG = { passkeyCount: 0, twoFactorEnabled: true };
const PASSKEY = { passkeyCount: 2, twoFactorEnabled: false };

describe("assertAdminSecondFactor", () => {
  it("allows an admin with two-factor authentication", () => {
    expect(() => assertAdminSecondFactor(STRONG)).not.toThrow();
  });

  it("allows an admin who enrolled a passkey instead of 2FA", () => {
    expect(() => assertAdminSecondFactor(PASSKEY)).not.toThrow();
  });

  it("locks out an admin with a magic-link session and no second factor", () => {
    const error = captureError({ passkeyCount: 0, twoFactorEnabled: false });

    expect(error.code).toBe("FORBIDDEN");
    expect(error.message).toContain("two-factor");
  });

  it("no longer accepts a `banned` field, so the dead branch cannot quietly come back", () => {
    expect(() =>
      assertAdminSecondFactor({
        // @ts-expect-error the input type must reject `banned`; if the field returns this stops being an error and the build fails
        banned: true,
        passkeyCount: 1,
        twoFactorEnabled: true,
      }),
    ).not.toThrow();
  });
});

function captureError(input: Parameters<typeof assertAdminSecondFactor>[0]): TRPCError {
  try {
    assertAdminSecondFactor(input);
  } catch (error) {
    return error as TRPCError;
  }

  throw new Error("expected a throw");
}

describe("assertNotBanned", () => {
  const past = new Date(Date.now() - 60_000);
  const future = new Date(Date.now() + 60_000);

  it("lets an unbanned caller through", () => {
    expect(() => assertNotBanned({ banned: false })).not.toThrow();
    expect(() => assertNotBanned({ banned: null })).not.toThrow();
    expect(() => assertNotBanned({})).not.toThrow();
  });

  it("blocks a banned caller, which is the gap an API-key session used to slip through", () => {
    const error = captureBanError({ banned: true });

    expect(error.code).toBe("FORBIDDEN");
    expect(error.message).toContain("banned");
  });

  it("blocks a ban that has not expired yet", () => {
    expect(captureBanError({ banExpires: future, banned: true }).code).toBe("FORBIDDEN");
  });

  it("lets a caller through once the ban has run out", () => {
    expect(() => assertNotBanned({ banExpires: past, banned: true })).not.toThrow();
  });

  it("treats an unparsable expiry as still banned rather than as a free pass", () => {
    expect(captureBanError({ banExpires: "not-a-date", banned: true }).code).toBe("FORBIDDEN");
  });

  it("accepts an expiry that arrives as a serialized string, which is how it crosses the wire", () => {
    expect(() => assertNotBanned({ banExpires: past.toISOString(), banned: true })).not.toThrow();
    expect(captureBanError({ banExpires: future.toISOString(), banned: true }).code).toBe(
      "FORBIDDEN",
    );
  });
});

function captureBanError(input: Parameters<typeof assertNotBanned>[0]): TRPCError {
  try {
    assertNotBanned(input);
  } catch (error) {
    return error as TRPCError;
  }

  throw new Error("expected a throw");
}

describe("assertAdminTotpCode", () => {
  it("returns a well-formed code for the caller to verify", () => {
    expect(assertAdminTotpCode({ code: "123456", twoFactorEnabled: true })).toBe("123456");
    expect(assertAdminTotpCode({ code: " 123456 ", twoFactorEnabled: true })).toBe("123456");
  });

  it("refuses a destructive action with no code at all", () => {
    const error = captureTotpError({ twoFactorEnabled: true });

    expect(error.code).toBe("BAD_REQUEST");
    expect(error.message).toContain("authenticator");
  });

  it("treats a blank code as no code, since the dialog sends one when the field is empty", () => {
    const error = captureTotpError({ code: "   ", twoFactorEnabled: true });

    expect(error.code).toBe("BAD_REQUEST");
  });

  it("refuses a code that is not six digits instead of sending it to better-auth", () => {
    expect(captureTotpError({ code: "12345", twoFactorEnabled: true }).message).toContain(
      "six digits",
    );
    expect(captureTotpError({ code: "1234567", twoFactorEnabled: true }).message).toContain(
      "six digits",
    );
    expect(captureTotpError({ code: "abcdef", twoFactorEnabled: true }).message).toContain(
      "six digits",
    );
  });

  it("says why when the admin has no authenticator enrolled, rather than blaming the code", () => {
    const error = captureTotpError({ code: "123456", twoFactorEnabled: false });

    expect(error.code).toBe("FORBIDDEN");
    expect(error.message).toContain("authenticator app");
  });
});

function captureTotpError(input: { code?: string; twoFactorEnabled: boolean }): TRPCError {
  try {
    assertAdminTotpCode(input);
  } catch (error) {
    return error as TRPCError;
  }

  throw new Error("expected a throw");
}
