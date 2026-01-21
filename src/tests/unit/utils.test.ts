import { Prisma } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { describe, expect, it } from "vitest";

import { getInitials } from "@/shared/lib/get-initials";
import { cn, formatRelativeTime, sanitizePayload } from "@/shared/lib/utils";

import { handlePrismaError } from "@/server/utils/handle-prisma-error";

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
      expect(e.message).toContain("Record with this data already exists");
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

  describe("Shared Utils: sanitizePayload", () => {
    it("should redact sensitive fields on root level", () => {
      const input = {
        email: "test@mail.com",
        password: "123456",
        token: "abc",
      };

      const result = sanitizePayload(input);

      expect(result).toEqual({
        email: "test@mail.com",
        password: "***REDACTED***",
        token: "***REDACTED***",
      });
    });

    it("should redact nested sensitive fields", () => {
      const input = {
        user: {
          name: "Elon",
          credentials: {
            passwordHash: "hash123",
          },
        },
      };

      const result = sanitizePayload(input);

      expect(result).toEqual({
        user: {
          name: "Elon",
          credentials: {
            passwordHash: "***REDACTED***",
          },
        },
      });
    });

    it("should sanitize arrays", () => {
      const input = [{ token: "abc" }, { value: 42 }];

      const result = sanitizePayload(input);

      expect(result).toEqual([{ token: "***REDACTED***" }, { value: 42 }]);
    });

    it("should not mutate original object", () => {
      const input = {
        password: "secret",
      };

      const result = sanitizePayload(input);

      expect(input.password).toBe("secret");
      expect(result.password).toBe("***REDACTED***");
    });

    it("should return primitives as is", () => {
      expect(sanitizePayload(null)).toBe(null);
      expect(sanitizePayload("text")).toBe("text");
      expect(sanitizePayload(123)).toBe(123);
    });

    it("should handle deep mixed structures", () => {
      const input = {
        users: [
          {
            email: "a@mail.com",
            refresh_token: "r1",
          },
        ],
        meta: {
          count: 1,
        },
      };

      const result = sanitizePayload(input);

      expect(result).toEqual({
        users: [
          {
            email: "a@mail.com",
            refresh_token: "***REDACTED***",
          },
        ],
        meta: {
          count: 1,
        },
      });
    });
    it("should handle empty objects and arrays", () => {
      expect(sanitizePayload({})).toEqual({});
      expect(sanitizePayload([])).toEqual([]);
    });
  });
});
