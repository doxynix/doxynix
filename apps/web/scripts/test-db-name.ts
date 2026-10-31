// Anchored on purpose: a bare `includes("test")` would wave through `latest_prod`, which does
// contain those letters, and these tests TRUNCATE shared tables.
const TEST_DB_NAME = /^test$|_test$/;

export function isTestDatabaseName(name: string): boolean {
  return TEST_DB_NAME.test(name);
}

export function derivedTestDatabaseName(name: string): string {
  const base = name.replace(/_stress$/, "");

  return isTestDatabaseName(base) ? base : `${base}_test`;
}
