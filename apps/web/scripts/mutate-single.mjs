import { spawn } from "child_process";

const [, , mutatePath, testPath] = process.argv;

if (!mutatePath || !testPath) {
  console.error("\x1b[31m%s\x1b[0m", "Ошибка: Не указаны пути к файлам!");
  console.log("Использование: pnpm test:mutate-single <путь-к-файлу-кода> <путь-к-файлу-теста>");
  console.log(
    "Пример:        pnpm test:mutate-single src/app/api/proxy/route.ts src/tests/unit/proxy-route.test.ts"
  );
  process.exit(1);
}

const args = ["run", "--inPlace", "--mutate", mutatePath, "--testFiles", testPath];

const isWindows = process.platform === "win32";
const command = isWindows ? "stryker.cmd" : "stryker";

const strykerProcess = spawn(command, args, {
  stdio: "inherit",
  shell: false,
});

strykerProcess.on("error", (err) => {
  console.error("Failed to start Stryker process:", err.message);
  process.exit(1);
});

strykerProcess.on("exit", (code) => {
  process.exit(code ?? 0);
});
