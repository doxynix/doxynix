import { describe, expect, it } from "vitest";

import { findPendingMigrations, localMigrations } from "./check-migrations";

describe("findPendingMigrations", () => {
  it("reports nothing when every migration is applied", () => {
    const local = ["001_init", "002_add_users"];

    expect(findPendingMigrations(local, new Set(local))).toEqual([]);
  });

  it("reports the migrations the database is missing", () => {
    const local = ["001_init", "002_add_users", "003_add_audit"];

    expect(findPendingMigrations(local, new Set(["001_init"]))).toEqual([
      "002_add_users",
      "003_add_audit",
    ]);
  });

  it("ignores database rows that are no longer in the repository", () => {
    const local = ["001_init"];

    expect(findPendingMigrations(local, new Set(["001_init", "000_removed"]))).toEqual([]);
  });

  it("treats an empty database as fully pending", () => {
    expect(findPendingMigrations(["001_init", "002_x"], new Set())).toEqual(["001_init", "002_x"]);
  });
});

describe("localMigrations", () => {
  it("reads the committed migration directories", () => {
    const migrations = localMigrations();

    expect(migrations.length).toBeGreaterThan(0);
    expect(migrations).toEqual(migrations.toSorted());
    expect(migrations.every((name) => name.length > 0)).toBe(true);
  });

  it("does not include the migration lock file", () => {
    expect(localMigrations()).not.toContain("migration_lock.toml");
  });
});
