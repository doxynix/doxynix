import { TRPCError } from "@trpc/server";

export type AdminSecondFactorInput = {
  passkeyCount: number;
  twoFactorEnabled: boolean;
};

export function assertAdminSecondFactor(input: AdminSecondFactorInput): void {
  if (!(input.twoFactorEnabled || input.passkeyCount > 0)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message:
        "Admin access requires two-factor authentication or a passkey. Enable one under Settings → Connections.",
    });
  }
}

export type BanStateInput = {
  banExpires?: Date | null | string;
  banned?: boolean | null;
};

export function assertNotBanned(input: BanStateInput): void {
  if (input.banned !== true) {
    return;
  }

  const expires = input.banExpires == null ? null : new Date(input.banExpires);
  const isOver =
    expires != null && !Number.isNaN(expires.getTime()) && expires.getTime() <= Date.now();

  if (isOver) {
    return;
  }

  throw new TRPCError({
    code: "FORBIDDEN",
    message: "This account is banned and cannot use the API.",
  });
}

const TOTP_PATTERN = /^\d{6}$/;

export function assertAdminTotpCode(input: { code?: string; twoFactorEnabled: boolean }): string {
  if (!input.twoFactorEnabled) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message:
        "This action requires an authenticator app code. Enroll one under Settings → Connections.",
    });
  }

  if (input.code == null || input.code.trim() === "") {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Confirm this action with a code from your authenticator app.",
    });
  }

  const code = input.code.trim();

  if (!TOTP_PATTERN.test(code)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "The confirmation code must be six digits.",
    });
  }

  return code;
}
