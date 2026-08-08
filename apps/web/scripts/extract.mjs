import { readdirSync, readFileSync, statSync, writeFileSync } from "fs";
import { join, resolve } from "path";

const rootDir = resolve("./src/server");
const outputFile = "./server_dump.json";

function walk(dir, result = []) {
  const files = readdirSync(dir);

  for (const file of files) {
    const fullPath = join(dir, file);

    if (fullPath.includes("node_modules") || fullPath.includes(".git")) {
      continue;
    }

    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      walk(fullPath, result);
    } else if (file.endsWith(".ts") || file.endsWith(".tsx")) {
      const content = readFileSync(fullPath, "utf8");

      result.push({
        path: fullPath.replace(/\\/g, "/"),
        content,
      });
    }
  }

  return result;
}

const data = walk(rootDir);

writeFileSync(outputFile, JSON.stringify(data, null, 2), "utf8");

console.log(`Готово! Файлов: ${data.length}`);
