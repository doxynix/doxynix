import { spawn } from "node:child_process";

const args = process.argv.slice(2);
const command = args.join(" ");

if (!command) {
  console.error("No command provided");
  process.exit(1);
}

const isCI = process.env.CI === "true" || process.env.VERCEL === "1";

const finalCommand = isCI ? command : `doppler run -- ${command}`;

const shell = process.platform === "win32" ? true : "/bin/sh";

const child = spawn(finalCommand, {
  stdio: "inherit",
  shell: shell,
});

child.on("exit", (code) => {
  process.exit(code ?? 0);
});
