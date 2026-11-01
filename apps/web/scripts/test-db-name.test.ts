import { describe, expect, it } from "vitest";

import { derivedTestDatabaseName, isTestDatabaseName } from "./test-db-name";

describe("isTestDatabaseName", () => {
  it.each(["dxnx_web_test", "test", "latest_test"])("accepts %s", (name) => {
    expect(isTestDatabaseName(name)).toBe(true);
  });

  it.each(["latest_prod", "test_prod", "prod", "dxnx_web", "latest", "testing"])(
    "refuses %s",
    (name) => {
      expect(isTestDatabaseName(name)).toBe(false);
    },
  );
});

describe("derivedTestDatabaseName", () => {
  it("appends the suffix to a development database", () => {
    expect(derivedTestDatabaseName("dxnx_web")).toBe("dxnx_web_test");
  });

  it("leaves an already disposable database untouched", () => {
    expect(derivedTestDatabaseName("dxnx_web_test")).toBe("dxnx_web_test");
  });

  it("strips the stress suffix instead of stacking it", () => {
    expect(derivedTestDatabaseName("dxnx_web_stress")).toBe("dxnx_web_test");
  });

  it("still refuses to treat a prod-like name as disposable", () => {
    // The derived name is disposable, so the reset happens on a scratch DB, not on prod.
    expect(derivedTestDatabaseName("latest_prod")).toBe("latest_prod_test");
  });
});
