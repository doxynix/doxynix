import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { appRouter } from "./index";

type Spec = {
  paths?: Record<string, Record<string, { responses?: Record<string, unknown> }>>;
};

const SPEC_PATH = join(process.cwd(), "public/openapi.json");

function readSpec(): Spec {
  return JSON.parse(readFileSync(SPEC_PATH, "utf8")) as Spec;
}

type JsonSchema = { properties?: Record<string, JsonSchema> };

function unwrapEnvelope(schema: JsonSchema): JsonSchema {
  let current = schema;
  let unwrapped = 0;

  for (const segment of ["result", "data"] as const) {
    const next = current.properties?.[segment];
    if (next?.properties == null) {
      break;
    }
    current = next;
    unwrapped += 1;
  }

  if (unwrapped === 0) {
    throw new Error("expected a tRPC `result.data` envelope on the documented 200 response");
  }

  return current;
}

function documentedKeys(spec: Spec, path: string, method: string): null | string[] {
  const responses = spec.paths?.[path]?.[method]?.responses as
    | Record<string, { content?: Record<string, { schema?: JsonSchema }> }>
    | undefined;
  const schema = responses?.["200"]?.content?.["application/json"]?.schema;

  if (schema?.properties == null) {
    return null;
  }

  return Object.keys(unwrapEnvelope(schema).properties ?? {}).sort();
}

function flatten(router: Record<string, unknown>, prefix = ""): Map<string, unknown> {
  const out = new Map<string, unknown>();

  for (const [key, value] of Object.entries(router)) {
    if (key.startsWith("_") || value == null) {
      continue;
    }

    const label = prefix === "" ? key : `${prefix}.${key}`;

    if (typeof value === "function") {
      out.set(label, value);
    } else if (typeof value === "object") {
      for (const [nested, procedure] of flatten(value as Record<string, unknown>, label)) {
        out.set(nested, procedure);
      }
    }
  }

  return out;
}

function outputKeys(procedure: unknown): null | string[] {
  const shape = (
    procedure as { _def?: { output?: { _def?: { shape?: Record<string, unknown> } } } }
  )._def?.output?._def?.shape;

  return shape == null ? null : Object.keys(shape).sort();
}

const procedures = flatten(appRouter as unknown as Record<string, unknown>);
const withOutput = [...procedures].filter(([, p]) => outputKeys(p) != null);

describe("openapi.json tracks the routers", () => {
  it("finds the procedures to check, so this test cannot pass vacuously", () => {
    expect(withOutput.length).toBeGreaterThan(0);
    expect(procedures.size).toBeGreaterThan(withOutput.length);
  });

  it("documents a response schema for every procedure that declares an .output()", () => {
    const spec = readSpec();
    const undocumented: string[] = [];

    for (const [label] of withOutput) {
      const path = `/${label}`;
      const methods = spec.paths?.[path];

      if (methods == null || Object.keys(methods).length === 0) {
        undocumented.push(label);
      }
    }

    expect(undocumented).toEqual([]);
  });

  it("documents exactly the keys each .output() schema promises, no more and no less", () => {
    const spec = readSpec();
    const mismatches: string[] = [];

    for (const [label, procedure] of withOutput) {
      const expected = outputKeys(procedure);
      const path = `/${label}`;

      for (const method of Object.keys(spec.paths?.[path] ?? {})) {
        const actual = documentedKeys(spec, path, method);

        if (actual == null) {
          continue;
        }

        if (JSON.stringify(actual) !== JSON.stringify(expected)) {
          mismatches.push(
            `${method.toUpperCase()} ${path}\n    schema:   ${JSON.stringify(expected)}\n    openapi:  ${JSON.stringify(actual)}`,
          );
        }
      }
    }

    expect(mismatches).toEqual([]);
  });
});
