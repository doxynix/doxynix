import type { AuditLog } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/server/utils/ua-parser", () => ({
  formatUserAgent: vi.fn().mockReturnValue("Mocked Browser"),
}));

import { mapAuditLogToDTO, sanitizeObject } from "./audit.mapper";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DESKTOP_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const IPHONE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
const IPAD_UA =
  "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

function makeAuditLog(overrides: Partial<AuditLog> = {}): AuditLog {
  return {
    createdAt: new Date("2024-01-01T00:00:00Z"),
    id: "test-id-123",
    ip: "127.0.0.1",
    model: "Repo",
    operation: "create",
    payload: {},
    requestId: "req-1",
    userAgent: null,
    userId: 1,
    ...overrides,
  }; // spread of Partial<AuditLog> over full defaults keeps the result assignable to AuditLog
}

// ===========================================================================
// sanitizeObject
// ===========================================================================

describe("sanitizeObject", () => {
  it("returns {} for null", () => {
    expect(sanitizeObject(null)).toEqual({});
  });

  it("returns {} for a number", () => {
    expect(sanitizeObject(42)).toEqual({});
  });

  it("returns {} for a string", () => {
    expect(sanitizeObject("str")).toEqual({});
  });

  it("removes SKIP_FIELDS while preserving other keys", () => {
    const input = { id: 1, name: "x", nested: { a: 1 }, repoId: 2 };
    expect(sanitizeObject(input)).toEqual({ name: "x", nested: { a: 1 } });
  });

  it("converts bigint values to strings", () => {
    expect(sanitizeObject({ n: 10n })).toEqual({ n: "10" });
  });
});

// ===========================================================================
// mapAuditLogToDTO
// ===========================================================================

describe("mapAuditLogToDTO", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -----------------------------------------------------------------------
  // OP_MAP / severity
  // -----------------------------------------------------------------------

  describe("OP_MAP / severity", () => {
    it.each([
      ["create", "Created", "success"],
      ["delete", "Deleted", "error"],
      ["deleteMany", "Bulk Deleted", "error"],
      ["update", "Updated", "info"],
      ["upsert", "Modified", "info"],
      ["unknown", "unknown", "info"],
    ] as const)(
      'operation "%s" → actionTitle "%s", severity "%s"',
      (operation, expectedTitle, expectedSeverity) => {
        const log = makeAuditLog({ operation });
        const dto = mapAuditLogToDTO(log);

        expect(dto.actionTitle).toBe(expectedTitle);
        expect(dto.severity).toBe(expectedSeverity);
      },
    );
  });

  // -----------------------------------------------------------------------
  // MODEL_CONFIG / targetName
  // -----------------------------------------------------------------------

  describe("MODEL_CONFIG / targetName", () => {
    it("Repo with data.fullName uses fullName", () => {
      const log = makeAuditLog({
        model: "Repo",
        payload: { data: { fullName: "org/repo" } },
      });
      expect(mapAuditLogToDTO(log).targetName).toBe("org/repo");
    });

    it("Repo with data.name (no fullName) uses name", () => {
      const log = makeAuditLog({
        model: "Repo",
        payload: { data: { name: "my-repo" } },
      });
      expect(mapAuditLogToDTO(log).targetName).toBe("my-repo");
    });

    it("Repo with where.name (no data) uses where.name", () => {
      const log = makeAuditLog({
        model: "Repo",
        payload: { where: { name: "target-repo" } },
      });
      expect(mapAuditLogToDTO(log).targetName).toBe("target-repo");
    });

    it('Repo with nothing falls back to "Repository"', () => {
      const log = makeAuditLog({ model: "Repo", payload: {} });
      expect(mapAuditLogToDTO(log).targetName).toBe("Repository");
    });

    it("User with data.name uses name", () => {
      const log = makeAuditLog({
        model: "User",
        payload: { data: { name: "Alice" } },
      });
      expect(mapAuditLogToDTO(log).targetName).toBe("Alice");
    });

    it('User without data.name falls back to "Personal Profile"', () => {
      const log = makeAuditLog({
        model: "User",
        payload: { data: {} },
      });
      expect(mapAuditLogToDTO(log).targetName).toBe("Personal Profile");
    });

    it('Account with data.provider "github" → "github login"', () => {
      const log = makeAuditLog({
        model: "Account",
        payload: { data: { provider: "github" } },
      });
      expect(mapAuditLogToDTO(log).targetName).toBe("github login");
    });

    it("default model with where.id sliced to 8 chars", () => {
      const log = makeAuditLog({
        model: "Notification",
        payload: { where: { id: "abc12345def" } },
      });
      expect(mapAuditLogToDTO(log).targetName).toBe("abc12345");
    });

    it('default model with no where.id falls back to "System Entity"', () => {
      const log = makeAuditLog({
        model: "Notification",
        payload: {},
      });
      expect(mapAuditLogToDTO(log).targetName).toBe("System Entity");
    });
  });

  // -----------------------------------------------------------------------
  // details / device / browser
  // -----------------------------------------------------------------------

  describe("details / device / browser", () => {
    it("primitive fields become details with camelCase labels", () => {
      const log = makeAuditLog({
        payload: { data: { emailVerified: true, firstName: "John" } },
      });
      const dto = mapAuditLogToDTO(log);

      // Biome sorts object keys, which determines Object.entries iteration order
      expect(dto.details).toEqual([
        { label: "email verified", value: "true" },
        { label: "first name", value: "John" },
      ]);
    });

    it("excludes null and object values from details", () => {
      const log = makeAuditLog({
        payload: { data: { deleted: null, metadata: { a: 1 }, name: "x" } },
      });
      const dto = mapAuditLogToDTO(log);

      expect(dto.details).toEqual([{ label: "name", value: "x" }]);
    });

    it("returns null details when data is empty", () => {
      const log = makeAuditLog({ payload: { data: {} } });
      expect(mapAuditLogToDTO(log).details).toBeNull();
    });

    it('internal userAgent → deviceType "system"', () => {
      const log = makeAuditLog({ userAgent: "internal" });
      expect(mapAuditLogToDTO(log).deviceType).toBe("system");
    });

    it("iPhone UA → deviceType mobile", () => {
      const log = makeAuditLog({ userAgent: IPHONE_UA });
      expect(mapAuditLogToDTO(log).deviceType).toBe("mobile");
    });

    it("iPad UA → deviceType tablet", () => {
      const log = makeAuditLog({ userAgent: IPAD_UA });
      expect(mapAuditLogToDTO(log).deviceType).toBe("tablet");
    });

    it("Desktop UA → deviceType desktop", () => {
      const log = makeAuditLog({ userAgent: DESKTOP_UA });
      expect(mapAuditLogToDTO(log).deviceType).toBe("desktop");
    });

    it("null userAgent → deviceType desktop", () => {
      const log = makeAuditLog({ userAgent: null });
      expect(mapAuditLogToDTO(log).deviceType).toBe("desktop");
    });
  });

  // -----------------------------------------------------------------------
  // rawPayload
  // -----------------------------------------------------------------------

  describe("rawPayload", () => {
    it("returns sanitized payload with SKIP_FIELDS removed", () => {
      const log = makeAuditLog({
        payload: { data: { id: 1, name: "x", repoId: 2 }, where: { userId: "u1" } },
      });
      const dto = mapAuditLogToDTO(log);

      expect(dto.rawPayload).toEqual({ data: { name: "x" }, where: {} });
    });
  });
});
