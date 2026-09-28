import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";

import { generatorHandler } from "@prisma/generator-helper";
import { dirname, resolve } from "pathe";

const ENCRYPTED_RE = /@encrypted(?<query>\?[\w=&]+)?/;
const HASH_RE = /@encryption:hash\((?<fieldName>\w+)\)(?<query>\?[\w=&]+)?/;
const SUPPORTED_NORMALIZE = ["lowercase", "trim"] as const;
const RELATION_SCALARS = new Set([
  "String",
  "Int",
  "BigInt",
  "Boolean",
  "DateTime",
  "Float",
  "Json",
  "Bytes",
  "Decimal",
]);

type NormalizeOption = (typeof SUPPORTED_NORMALIZE)[number];

type FieldSpec = { hash?: { normalize: NormalizeOption[] } };
type ModelSpec = { connections: Record<string, string>; fields: Record<string, FieldSpec> };
type Spec = Record<string, ModelSpec>;

type DmmfField = {
  documentation?: null | string;
  isId?: boolean;
  isList?: boolean;
  isUnique?: boolean;
  name: string;
  type: string;
};
type DmmfModel = { fields?: readonly DmmfField[]; name: string };

/** Structural, `readonly` view of the generator's DMMF (it hands over a `ReadonlyDeep`). */
type Datamodel = { datamodel?: { models?: readonly DmmfModel[] } };

/** Exported for unit tests; the generator itself only needs `onGenerate`. */
export function buildSpec(dmmf: Datamodel): Spec {
  const models = dmmf.datamodel?.models ?? [];
  const spec: Spec = {};

  for (const model of models) {
    const fields = model.fields ?? [];
    const modelSpec: ModelSpec = { connections: {}, fields: {} };

    for (const field of fields) {
      if (!RELATION_SCALARS.has(field.type)) {
        const target = models.find((m) => m.name === field.type);
        if (target != null) {
          modelSpec.connections[field.name] = target.name;
        }
      }
    }

    for (const field of fields) {
      if (parseEncrypted(field.documentation)) {
        if (field.type !== "String") {
          throw new Error(
            `[field-encryption] ${model.name}.${field.name} is @encrypted but is ${field.type}; only String is supported.`,
          );
        }
        modelSpec.fields[field.name] = {};
      }
    }

    for (const field of fields) {
      const hash = parseHash(field.documentation);

      if (hash == null) {
        continue;
      }

      if (field.type !== "String") {
        throw new Error(
          `[field-encryption] ${model.name}.${field.name} is a hash field but is ${field.type}; only String is supported.`,
        );
      }

      const source = modelSpec.fields[hash.fieldName];

      if (source == null) {
        throw new Error(
          `[field-encryption] ${model.name}.${field.name} hashes ${hash.fieldName}, which is not @encrypted.`,
        );
      }

      source.hash = { normalize: hash.normalize };
    }

    if (Object.keys(modelSpec.fields).length > 0 || Object.keys(modelSpec.connections).length > 0) {
      spec[model.name] = modelSpec;
    }
  }

  return spec;
}

function parseEncrypted(documentation?: null | string): boolean {
  if (documentation == null) {
    return false;
  }
  const match = ENCRYPTED_RE.exec(documentation);
  return match != null && (match.groups?.query == null || !match.groups.query.includes("readonly"));
}

function parseHash(
  documentation?: null | string,
): { fieldName: string; normalize: NormalizeOption[] } | null {
  if (documentation == null) {
    return null;
  }

  const match = HASH_RE.exec(documentation);

  if (match?.groups?.fieldName == null) {
    return null;
  }

  const query = new URLSearchParams(match.groups.query ?? "");
  const normalize = query
    .getAll("normalize")
    .filter((n): n is NormalizeOption => (SUPPORTED_NORMALIZE as readonly string[]).includes(n));

  return { fieldName: match.groups.fieldName, normalize };
}

function render(dmmf: Datamodel): string {
  const spec = buildSpec(dmmf);
  const models = Object.keys(spec)
    .sort()
    .map((name) => {
      const model = spec[name];
      if (model == null) {
        return "";
      }
      const lines: string[] = [];
      for (const field of Object.keys(model.fields).sort()) {
        const entry = model.fields[field];
        if (entry?.hash == null) {
          lines.push(`    ${JSON.stringify(field)}: {},`);
        } else {
          lines.push(
            `    ${JSON.stringify(field)}: { hash: { normalize: [${entry.hash.normalize
              .map((n) => JSON.stringify(n))
              .join(", ")}] } },`,
          );
        }
      }
      const connections = Object.keys(model.connections)
        .sort()
        .map(
          (field) => `    ${JSON.stringify(field)}: ${JSON.stringify(model.connections[field])},`,
        );
      return `  ${JSON.stringify(name)}: {\n    connections: {\n${connections.join("\n")}\n    },\n    fields: {\n${lines.join("\n")}\n    },\n  },`;
    })
    .filter((s) => s.length > 0);

  return [
    "// This file was automatically generated via Prisma DMMF. DO NOT EDIT MANUALLY.",
    "",
    "export type FieldSpec = {",
    "  hash?: {",
    '    normalize: Array<"lowercase" | "trim">;',
    "  };",
    "};",
    "",
    "export type ModelSpec = {",
    "  connections: Record<string, string>;",
    "  fields: Record<string, FieldSpec>;",
    "};",
    "",
    `export const FIELD_ENCRYPTION_SPEC: Record<string, ModelSpec> = {\n${models.join("\n")}\n};`,
    "",
  ].join("\n");
}

generatorHandler({
  async onGenerate(options) {
    const value = options.generator.output?.value;

    if (value == null) {
      throw new Error("[field-encryption] No output file specified");
    }

    const outputPath = resolve(value);
    await fs.mkdir(dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, render(options.dmmf), "utf-8");

    // Immediately bring the generated file into repo format so the pre-commit
    // Biome pass doesn't rewrite it on every `db:generate`. A formatting error
    // must not fail generation. Mirrors `enum-generator.ts`.
    try {
      execFileSync("bun", ["x", "biome", "format", "--write", outputPath], {
        stdio: "ignore",
      });
    } catch {
      // biome may be missing in the generation environment — the file is still valid.
    }
  },
});
