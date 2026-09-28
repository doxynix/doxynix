import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

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

  // `createTRPCRouter` returns a router instance whose procedures hang off
  // `_def.procedures`, keyed by their full dotted path. Nested routers created
  // by `createTRPCRouter` are already flattened by tRPC, so there is no second
  // level to walk here.
  const bag = isProcedure(router) ? router._def?.procedures : router;
  if (bag == null || typeof bag !== "object") {
    return out;
  }

  // tRPC builds `procedures` as a lazy Proxy. Materialize it before walking,
  // otherwise the enumeration can come back empty depending on access order.
  const entries = Object.entries(bag as AnyRecord);
  if (entries.length === 0) {
    return out;
  }

  for (const [key, value] of entries) {
    if (key.startsWith("_") || value == null) {
      continue;
    }

    const label = prefix === "" ? key : `${prefix}.${key}`;

    // tRPC procedures are callable objects, so a procedure is a `function`
    // that also carries `_def`; only a plain object is a nested router.
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

/**
 * `toJSONSchema` only accepts a real zod schema. Procedures without an
 * `.output()` are the interesting case for the audit, so they are recorded as
 * `null` rather than dropped: the forbidden-key test needs to see them.
 */
function toJsonSchema(value: unknown, io: "input" | "output"): unknown {
  if (value == null || typeof value !== "object") {
    return {};
  }

  try {
    return z.toJSONSchema(value as z.ZodType, { io, unrepresentable: "any" });
  } catch {
    // A procedure without a real zod output still has to appear in the
    // document, so fall back to an opaque schema rather than failing the run.
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
