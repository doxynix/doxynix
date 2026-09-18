import { spawn } from "node:child_process";

console.log("🚀 Launching ZenStack via smart trigger...");

const child = spawn(
  "bunx",
  ["--bun", "zenstack", "generate", "--schema", "prisma/schema.zmodel", "--offline"],
  {
    shell: true,
  },
);

child.stdout.on("data", (data) => {
  const output = data.toString();
  process.stdout.write(output);

  if (output.includes("All plugins completed successfully!")) {
    console.log("\n✅ ZenStack reported success. Forcing exit.");
    child.kill("SIGKILL");
    process.exit(0);
  }
});

child.stderr.on("data", (data) => {
  process.stderr.write(data.toString());
});

child.on("exit", (code) => {
  if (code !== 0 && code !== null) {
    console.error(`\n❌ ZenStack finished with an error (code ${code})`);
    process.exit(code || 1);
  }
});
