/**
 * Run a command against the disposable test database.
 *
 * `test:int` truncates shared tables between files, so it refuses to run against anything but a
 * database whose name contains `test`. With `with-doppler` that meant the script always pointed
 * at the development database and failed every time — the guard working, the wiring wrong.
 *
 * So the URL is rewritten here rather than left to whatever Doppler injects:
 *
 *   DATABASE_URL …/dxnx_web      →  …/dxnx_web_test
 *   DATABASE_URL …/dxnx_web_test →  unchanged
 *   DATABASE_URL …/dxnx_web_stress → refused: a stress clone is a fixture, not a scratch DB
 *
 * Override the target with TEST_DATABASE_URL, or bypass the rewrite entirely by pointing
 * DATABASE_URL somewhere that already contains `test`.
 *
 * Usage: bun scripts/with-test-db.ts <command> [args…]
 */
import { spawn } from "node:child_process";

function derivedName(name: string): string {
  return name.replace(/_stress$/, "").endsWith("_test")
    ? name
    : `${name.replace(/_stress$/, "")}_test`;
}

function parse(url: string): { host: string; name: string } | null {
  try {
    const parsed = new URL(url);
    return { host: parsed.host, name: parsed.pathname.replace(/^\//, "") };
  } catch {
    return null;
  }
}
const command = process.argv.slice(2);
if (command.length === 0) {
  console.error("usage: bun scripts/with-test-db.ts <command> [args…]");
  process.exit(1);
}
const source = process.env.DATABASE_URL;
if (source == null) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}
const parsed = parse(source);
if (parsed == null) {
  console.error(`DATABASE_URL is not a valid URL: ${source}`);
  process.exit(1);
}
// No explicit override: derive `<name>_test` from whatever Doppler injected, which is the
// naming `init-dbs.sql` and the guard's own "must contain test" rule both assume.
const derived = new URL(source);
derived.pathname = `/${derivedName(parsed.name)}`;

const override = process.env.TEST_DATABASE_URL;
const target = override == null ? derived : new URL(override);
const name = target.pathname.replace(/^\//, "");

if (!name.includes("test")) {
  console.error(
    `refusing to run against "${name}": integration tests truncate shared tables, so the target ` +
      `database must contain "test" in its name`,
  );
  process.exit(1);
}

if (parsed.name === name) {
  console.warn(`using ${name} as given`);
} else {
  console.warn(`redirecting ${parsed.name} → ${name}`);
}

const child = spawn(command[0], command.slice(1), {
  env: { ...process.env, DATABASE_URL: target.toString() },
  stdio: "inherit",
});
child.on("close", (code, signal) => {
  if (signal != null) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
