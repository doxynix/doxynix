import { spawn } from "child_process";

console.log("🚀 Запуск ZenStack через умный триггер...");

const child = spawn(
  "bunx",
  ["--bun", "zenstack", "generate", "--schema", "prisma/schema.zmodel", "--offline"],
  {
    shell: true,
  }
);

child.stdout.on("data", (data) => {
  const output = data.toString();
  process.stdout.write(output);

  if (output.includes("All plugins completed successfully!")) {
    console.log("\n✅ ZenStack отрапортовал об успехе. Принудительный выход.");
    child.kill("SIGKILL");
    process.exit(0);
  }
});

child.stderr.on("data", (data) => {
  process.stderr.write(data.toString());
});

child.on("exit", (code) => {
  if (code !== 0 && code !== null) {
    console.error(`\n❌ ZenStack завершился с ошибкой (код ${code})`);
    process.exit(code || 1);
  }
});
