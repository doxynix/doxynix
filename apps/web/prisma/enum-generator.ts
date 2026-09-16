import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

import { generatorHandler } from "@prisma/generator-helper";

const header = `// This file was automatically generated via Prisma DMMF. DO NOT EDIT MANUALLY.
import * as z from "zod/mini";\n\n`;

generatorHandler({
  async onGenerate(options) {
    const enums = options.dmmf.datamodel.enums;

    const output = enums.map((e) => {
      // Сортируем значения по алфавиту: DMMF отдаёт их в порядке объявления
      // в schema.prisma, а репо-политика biome (useSortedKeys) требует сортировки.
      const values = [...e.values].sort((a, b) => a.name.localeCompare(b.name));
      const valuesArray = values.map(({ name: value }) => `"${value}"`).join(", ");

      let str = `// ------------------- ${e.name} -------------------\n`;
      str += `export const ${e.name}Schema = z.enum([${valuesArray}]);\n`;
      str += `export type ${e.name} = z.infer<typeof ${e.name}Schema>;\n`;
      str += `export const ${e.name} = {\n`;
      values.forEach(({ name: value }) => {
        str += `  ${value}: "${value}",\n`;
      });
      str += `} as const;\n\n`;

      return str;
    });

    const outputFile = options.generator.output;
    if (!outputFile?.value) {
      throw new Error("No output file specified");
    }

    const outputPath = path.resolve(outputFile.value);
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, header + output.join("\n"), "utf-8");

    // Сразу приводим сгенерированный файл к репо-формату (переносы длинных
    // z.enum-массивов и прочее), чтобы не прогонять biome руками после
    // каждого `db:generate`. Ошибка форматирования не должна валить генерацию.
    try {
      execFileSync("bun", ["x", "biome", "format", "--write", outputPath], {
        stdio: "ignore",
      });
    } catch {
      // biome может отсутствовать в окружении генерации — файл всё равно валиден.
    }
  },
  onManifest() {
    return {
      defaultOutput: "../../../packages/shared/src/enums/index.ts",
      prettyName: "Doxynix Enums & Zod Generator",
    };
  },
});
