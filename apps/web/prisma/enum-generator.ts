import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";

import { generatorHandler } from "@prisma/generator-helper";
import { dirname, resolve } from "pathe";

const header = `// This file was automatically generated via Prisma DMMF. DO NOT EDIT MANUALLY.
import * as z from "zod/mini";\n\n`;

generatorHandler({
  async onGenerate(options) {
    const enums = options.dmmf.datamodel.enums;

    const output = enums.map((e) => {
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

    const outputPath = resolve(outputFile.value);
    await fs.mkdir(dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, header + output.join("\n"), "utf-8");

    try {
      execFileSync("bun", ["x", "biome", "format", "--write", outputPath], {
        stdio: "ignore",
      });
    } catch {
      // biome may be missing in the generation environment — the file is still valid.
    }
  },
  onManifest() {
    return {
      defaultOutput: "../../../packages/shared/src/enums/index.ts",
      prettyName: "Doxynix Enums & Zod Generator",
    };
  },
});
