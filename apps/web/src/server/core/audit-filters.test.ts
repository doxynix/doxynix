import { describe, expect, it } from "vitest";

import { isBookkeepingWrite, shouldPublishAuditUpdated } from "./audit-filters";

describe("isBookkeepingWrite", () => {
  it.each([
    ["ApiKey", "update", "lastUsed"],
    ["ApiKey", "updateMany", "lastUsed"],
    ["Analysis", "update", "progress"],
    ["Analysis", "updateMany", "progress"],
    ["Notification", "update", "isRead"],
    ["Notification", "updateMany", "isRead"],
  ])("treats %s.%s touching only %s as bookkeeping", (model, operation, field) => {
    const args = {
      data: { [field]: new Date() },
      where: { id: "0195a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b" },
    };

    expect(isBookkeepingWrite(model, operation, args)).toBe(true);
  });

  it("accepts Prisma's nested write filter on the bookkeeping field", () => {
    expect(
      isBookkeepingWrite("ApiKey", "updateMany", { data: { lastUsed: { set: new Date() } } }),
    ).toBe(true);
  });

  it.each([
    ["a manual revocation", "ApiKey", "update", { data: { revoked: true } }],
    ["a rename", "ApiKey", "update", { data: { name: "ci" } }],
    ["a second field", "ApiKey", "updateMany", { data: { lastUsed: new Date(), revoked: true } }],
    [
      "a milestone plus a status",
      "Analysis",
      "update",
      { data: { progress: 40, status: "FAILED" } },
    ],
    ["a read flag plus a title", "Notification", "update", { data: { isRead: true, title: "hi" } }],
    ["a model without bookkeeping fields", "Repo", "update", { data: { progress: 40 } }],
    ["a create", "ApiKey", "create", { data: { lastUsed: new Date() } }],
    ["an upsert", "Notification", "upsert", { data: { isRead: true } }],
  ])("keeps auditing %s", (_label, model, operation, args) => {
    expect(isBookkeepingWrite(model, operation, args)).toBe(false);
  });

  it.each([
    ["no args", undefined],
    ["null args", null],
    ["a scalar", "lastUsed"],
    ["an array", [{ data: { lastUsed: new Date() } }]],
    ["an empty object", {}],
    ["null data", { data: null }],
    ["scalar data", { data: "lastUsed" }],
    ["array data", { data: [{ lastUsed: new Date() }] }],
    ["empty data", { data: {} }],
  ])("stays defensive with %s", (_label, args) => {
    expect(isBookkeepingWrite("ApiKey", "update", args)).toBe(false);
  });
});

describe("shouldPublishAuditUpdated", () => {
  it("should publish when there is no request store", () => {
    expect(shouldPublishAuditUpdated(undefined)).toBe(true);
  });

  it("should publish when the store has not published yet, then set the flag", () => {
    const store: { auditUpdatedPublished?: boolean } = {};

    expect(shouldPublishAuditUpdated(store)).toBe(true);
    expect(store.auditUpdatedPublished).toBe(true);
  });

  it("should publish when the flag is explicitly false", () => {
    expect(shouldPublishAuditUpdated({ auditUpdatedPublished: false })).toBe(true);
  });

  it("should skip every later write in the same request", () => {
    const store: { auditUpdatedPublished?: boolean } = {};

    shouldPublishAuditUpdated(store);

    expect(shouldPublishAuditUpdated(store)).toBe(false);
  });
});
