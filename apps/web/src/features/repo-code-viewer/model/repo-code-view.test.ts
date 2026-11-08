import { describe, expect, it } from "vitest";

import { isBusy, shouldShowAuditPanel } from "./repo-code-view";

describe("shouldShowAuditPanel", () => {
  it("opens while an audit is pending", () => {
    expect(
      shouldShowAuditPanel({ isAuditDismissed: false, isAuditLoaded: false, pending: "audit" }),
    ).toBe(true);
  });

  it("stays closed while a document is being generated", () => {
    expect(
      shouldShowAuditPanel({ isAuditDismissed: false, isAuditLoaded: false, pending: "document" }),
    ).toBe(false);
  });

  it("opens for an audit result of the current file", () => {
    expect(
      shouldShowAuditPanel({ isAuditDismissed: false, isAuditLoaded: true, pending: null }),
    ).toBe(true);
  });

  it("respects dismissal", () => {
    expect(
      shouldShowAuditPanel({ isAuditDismissed: true, isAuditLoaded: true, pending: null }),
    ).toBe(false);
  });
});

describe("isBusy", () => {
  it("is false only without a pending action", () => {
    expect(isBusy(null)).toBe(false);
    expect(isBusy("audit")).toBe(true);
    expect(isBusy("document")).toBe(true);
  });
});
