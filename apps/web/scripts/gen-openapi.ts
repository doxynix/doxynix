import { mkdirSync, writeFileSync } from "node:fs";

import { dirname, join } from "pathe";
import * as z from "zod";

import { appRouter } from "../src/server/modules/index";

const OUTPUT = join(process.cwd(), "public/openapi.json");

type AnyRecord = Record<string, unknown>;

type Procedure = {
  _def?: {
    inputs?: unknown;
    meta?: AnyRecord;
    output?: unknown;
    procedures?: AnyRecord;
    type?: string;
  };
};

function isProcedure(value: unknown): value is Procedure {
  if (value == null || (typeof value !== "object" && typeof value !== "function")) {
    return false;
  }

  const def = (value as Procedure)._def;
  return typeof def === "object" && def != null;
}

function flatten(router: unknown, prefix = ""): Map<string, Procedure> {
  const out = new Map<string, Procedure>();

  const bag = isProcedure(router) ? router._def?.procedures : router;
  if (bag == null || typeof bag !== "object") {
    return out;
  }

  const entries = Object.entries(bag as AnyRecord);
  if (entries.length === 0) {
    return out;
  }

  for (const [key, value] of entries) {
    if (key.startsWith("_") || value == null) {
      continue;
    }

    const label = prefix === "" ? key : `${prefix}.${key}`;

    if (isProcedure(value)) {
      out.set(label, value);
    } else if (typeof value === "object") {
      for (const [nested, procedure] of flatten(value, label)) {
        out.set(nested, procedure);
      }
    }
  }

  return out;
}

function toJsonSchema(value: unknown, io: "input" | "output"): unknown {
  if (value == null || typeof value !== "object") {
    return {};
  }

  try {
    return z.toJSONSchema(value as z.ZodType, { io, unrepresentable: "any" });
  } catch {
    return {};
  }
}

function responseSchema(procedure: Procedure): unknown {
  const schema = toJsonSchema(procedure._def?.output, "output");

  return {
    content: {
      "application/json": {
        schema: {
          properties: {
            result: {
              properties: {
                data: schema,
              },
              required: ["data"],
              type: "object",
            },
          },
          required: ["result"],
          type: "object",
        },
      },
    },
    description: "Successful response",
  };
}

const procedures = flatten(appRouter);
const paths: Record<string, AnyRecord> = {};

for (const [label, procedure] of procedures) {
  const method = procedure._def?.type === "mutation" ? "post" : "get";
  const tag = label.split(".")[0];
  const path = `/${label}`;

  const operation: AnyRecord = {
    operationId: label,
    responses: { "200": responseSchema(procedure) },
    tags: [tag],
  };

  const input = procedure._def?.inputs;
  if (input != null) {
    const schema = toJsonSchema(input, "input");

    if (method === "post") {
      operation.requestBody = {
        content: { "application/json": { schema } },
        required: true,
      };
    } else {
      operation.parameters = [
        {
          content: { "application/json": { schema } },
          in: "query",
          name: "input",
          required: true,
          style: "deepObject",
        },
      ];
    }
  }

  paths[path] = { ...paths[path], [method]: operation };
}

const document = {
  info: { title: "Doxynix API", version: "1.0.0" },
  jsonSchemaDialect: "https://spec.openapis.org/oas/3.1/dialect/base",
  openapi: "3.1.1",
  paths,
};

mkdirSync(dirname(OUTPUT), { recursive: true });
writeFileSync(OUTPUT, `${JSON.stringify(document, null, 2)}\n`, "utf8");

const withOutput = [...procedures.values()].filter((p) => p._def?.output != null).length;
console.log(
  `Wrote ${Object.keys(paths).length} paths (${withOutput} with .output(), ${procedures.size - withOutput} without) to ${OUTPUT}`,
);
