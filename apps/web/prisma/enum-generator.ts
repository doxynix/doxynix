import fs from "node:fs/promises";
import path from "node:path";

import { generatorHandler } from "@prisma/generator-helper";

const header = `// This file was automatically generated via Prisma DMMF. DO NOT EDIT MANUALLY.
import * as z from "zod/mini";\n\n`;

generatorHandler({
  async onGenerate(options) {
    const enums = options.dmmf.datamodel.enums;

    const output = enums.map((e) => {
      const valuesArray = e.values.map(({ name: value }) => `"${value}"`).join(", ");

      let str = `// ------------------- ${e.name} -------------------\n`;
      str += `export const ${e.name}Schema = z.enum([${valuesArray}]);\n`;
      str += `export type ${e.name} = z.infer<typeof ${e.name}Schema>;\n`;
      str += `export const ${e.name} = {\n`;
      e.values.forEach(({ name: value }) => {
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
  },
  onManifest() {
    return {
      defaultOutput: "../../../packages/shared/src/enums/index.ts",
      prettyName: "Doxynix Enums & Zod Generator",
    };
  },
});
