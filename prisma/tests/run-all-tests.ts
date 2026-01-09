import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const C = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  gray: "\x1b[90m",
};

const TEST_DIR = path.join(process.cwd(), "prisma/tests");

function run(cmd: string, args: string[]) {
  const isWindows = process.platform === "win32";

  const command = isWindows && cmd === "pnpm" ? "pnpm.cmd" : cmd;

  execFileSync(command, args, { stdio: "inherit", shell: true });
}

function getNumberedTests(): string[] {
  return fs
    .readdirSync(TEST_DIR)
    .filter((f) => /^\d+-.*\.ts$/.test(f))
    .sort((a, b) => {
      const na = Number(a.split("-")[0]);
      const nb = Number(b.split("-")[0]);
      return na - nb;
    });
}

async function main() {
  console.log(`${C.cyan}🔐 ENTERPRISE SECURITY TEST SUITE${C.reset}`);
  console.log(`${C.gray}────────────────────────────────────────${C.reset}\n`);

  try {
    console.log(`${C.yellow}⚙️  Генерация ZenStack...${C.reset}`);
    run("pnpm", ["zenstack", "generate", "--schema", "prisma/schema.zmodel"]);

    const tests = ["clean-db.ts", ...getNumberedTests()];

    console.log(`${C.gray}🧪 Найдено тестов: ${tests.length}${C.reset}`);
    tests.forEach((t) => console.log(`${C.gray} - ${t}${C.reset}`));

    for (const test of tests) {
      const testPath = path.join(TEST_DIR, test);
      console.log(`\n${C.cyan}▶ RUN ${test}${C.reset}`);
      run("pnpm", ["tsx", testPath]);
    }

    console.log(`\n${C.green}🎉 ВСЕ ТЕСТЫ УСПЕШНО ПРОЙДЕНЫ${C.reset}`);
    console.log(`${C.green}🛡️  DATA-SECURITY: ENTERPRISE READY${C.reset}\n`);
    process.exit(0);
  } catch (e) {
    console.error(`\n${C.red}💥 ПРОВАЛ ТЕСТОВ${C.reset}`);
    console.error(e);
    process.exit(1);
  }
}

void main();
