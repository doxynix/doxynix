/* eslint-disable sonarjs/no-os-command-from-path */
import { spawn } from "node:child_process";

const args = process.argv.slice(2);
const command = args.join(" ");

if (!command) {
  console.error("No command provided");
  process.exit(1);
}

const isCI = process.env.CI === "true" || process.env.VERCEL === "1";

const shell = process.platform === "win32" ? process.env.ComSpec || "cmd.exe" : "/bin/sh";

const shellArgs = process.platform === "win32" ? ["/d", "/s", "/c", command] : ["-c", command];

const child = isCI
  ? spawn(shell, shellArgs, {
      stdio: "inherit",
    })
  : spawn("doppler", ["run", "--", shell, ...shellArgs], {
      stdio: "inherit",
    });

child.on("close", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 1);
});
