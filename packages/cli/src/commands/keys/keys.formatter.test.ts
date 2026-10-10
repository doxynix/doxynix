import { describe, expect, it } from "vitest";

import { stripAnsi } from "@/ui/formatters";

import { renderKeysTable } from "./keys.formatter";

const FULL_UUID = "12345678-1234-1234-1234-1234567890ab";

const rows = [
  {
    createdAt: "2024-01-01T00:00:00.000Z",
    id: FULL_UUID,
    lastUsed: "2024-02-01T00:00:00.000Z",
    name: "prod-key",
    prefix: "dxnx",
    revoked: false,
  },
  {
    createdAt: "2024-01-01T00:00:00.000Z",
    id: "87654321-4321-4321-4321-ba0987654321",
    lastUsed: null,
    name: "stale-key",
    prefix: "dxnx",
    revoked: true,
  },
] as any;

describe("keys formatter", () => {
  it("renders API key rows with active and revoked status", () => {
    const output = renderKeysTable(rows, { fullId: true });

    expect(output).toContain("prod-key");
    expect(output).toContain("stale-key");
    expect(output).toContain("Active");
    expect(output).toContain("Revoked");
  });

  it("shows the complete UUID when fullId is requested", () => {
    const output = stripAnsi(renderKeysTable(rows, { fullId: true }));

    expect(output).toContain(FULL_UUID);
    expect(output).not.toContain("12345678-1234-1234-1234-1234567890ab...");
  });

  it("truncates the UUID to a short prefix by default", () => {
    const output = stripAnsi(renderKeysTable(rows));

    expect(output).toContain("12345678...");
    expect(output).not.toContain(FULL_UUID);
  });

  it("renders 'Never' when a key has never been used", () => {
    expect(stripAnsi(renderKeysTable(rows, { fullId: true }))).toContain("Never");
  });
});
