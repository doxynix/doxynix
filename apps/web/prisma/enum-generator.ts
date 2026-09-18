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
      // Sort values alphabetically: DMMF returns them in declaration order
      // in schema.prisma, while the repo's biome policy (useSortedKeys) requires sorting.
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

    // Immediately bring the generated file into repo format (wrapping of long
    // z.enum arrays, etc.) so biome doesn't need to be run manually after
    // every `db:generate`. A formatting error must not fail generation.
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
