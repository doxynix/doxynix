import { Prisma } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { describe, expect, it } from "vitest";

import { getInitials } from "@/shared/lib/getInititals";
import { cn, formatRelativeTime } from "@/shared/lib/utils";

import { handlePrismaError } from "@/server/utils/handlePrismaError";

describe("Shared Utils", () => {
  describe("getInitials", () => {
    it("should return initials from name", () => {
      expect(getInitials("Elon Musk")).toBe("EM");
      expect(getInitials("Cher")).toBe("CH");
    });
    it("should return initials from email if name missing", () => {
      expect(getInitials(null, "test@mail.com")).toBe("TE");
    });
    it("should return U fallback", () => {
      expect(getInitials(null, null)).toBe("U");
    });
  });

  describe("cn (utils)", () => {
    it("should merge classes", () => {
      expect(cn("p-4", "p-2")).toContain("p-2");
      expect(cn("text-red-500", null, "bg-blue-500")).toContain("bg-blue-500");
    });
  });

  describe("formatRelativeTime", () => {
    it("should return dash for null", () => {
      expect(formatRelativeTime(null)).toBe("—");
    });
  });
});

describe("Server Utils: handlePrismaError", () => {
  it("should rethrow TRPCError", () => {
    const err = new TRPCError({ code: "BAD_REQUEST" });
    expect(() => handlePrismaError(err)).toThrow(TRPCError);
  });

  it("should map P2002 to CONFLICT", () => {
    const err = new Prisma.PrismaClientKnownRequestError("Unique constraint", {
      code: "P2002",
      clientVersion: "5.0",
    });

    try {
      handlePrismaError(err);
    } catch (e: any) {
      expect(e).toBeInstanceOf(TRPCError);
      expect(e.code).toBe("CONFLICT");
      expect(e.message).toContain("уже существует");
    }
  });

  it("should map P2025 to NOT_FOUND", () => {
    const err = new Prisma.PrismaClientKnownRequestError("Not found", {
      code: "P2025",
      clientVersion: "5.0",
    });

    try {
      handlePrismaError(err);
    } catch (e: any) {
      expect(e.code).toBe("NOT_FOUND");
    }
  });

  it("should handle unknown errors", () => {
    const err = new Error("Boom");
    try {
      handlePrismaError(err);
    } catch (e: any) {
      expect(e.code).toBe("INTERNAL_SERVER_ERROR");
    }
  });
});
