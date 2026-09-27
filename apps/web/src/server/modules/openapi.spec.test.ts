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

/**
 * Internal fields that must never appear in a documented response.
 *
 * The checks above walk outwards from the procedures that already declare an
 * `.output()`. That misses the procedure that declares none at all, which is
 * exactly where a raw Prisma row slips through. This walks inwards from the
 * forbidden names instead, so an undeclared procedure is visible here.
 *
 * `jobId` is deliberately absent: it is the Trigger.dev run id and the client
 * needs it to render progress. `resultJson` is also expected, and only in
 * `analysis.getById`, where the fix-detail view reads it to tell a running fix
 * from a finished one.
 */
const FORBIDDEN_RESPONSE_KEYS = [
  "accessToken",
  "changedFilesJson",
  "emailHash",
  "findingsJson",
  "idToken",
  "impersonatedBy",
  "logs",
  "metricsJson",
  "payload",
  "publicId",
  "publicKey",
  "refreshToken",
  "tokenHash",
] as const;

/** `resultJson` is sanctioned for this one procedure only. */
const RESULT_JSON_ALLOWLIST = new Set(["/analysis.getById"]);

function collectPropertyNames(schema: unknown, out = new Set<string>()): Set<string> {
  if (schema == null || typeof schema !== "object") {
    return out;
  }

  const node = schema as JsonSchema;

  for (const [key, nested] of Object.entries(node.properties ?? {})) {
    out.add(key);
    collectPropertyNames(nested, out);
  }

  return out;
}

describe("openapi.json exposes no internal field", () => {
  it("documents no forbidden response key on any procedure, declared output or not", () => {
    const spec = readSpec();
    const violations: string[] = [];

    for (const [path, methods] of Object.entries(spec.paths ?? {})) {
      for (const [method, operation] of Object.entries(methods)) {
        const response = (
          operation as {
            responses?: Record<string, { content?: Record<string, { schema?: unknown }> }>;
          }
        ).responses?.["200"];
        const schema = response?.content?.["application/json"]?.schema;
        const names = collectPropertyNames(schema);

        for (const key of names) {
          if (key === "resultJson" && RESULT_JSON_ALLOWLIST.has(path)) {
            continue;
          }

          if ((FORBIDDEN_RESPONSE_KEYS as readonly string[]).includes(key)) {
            violations.push(`${method.toUpperCase()} ${path} -> ${key}`);
          }
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it("documents no integer primary key, the external GitHub ids aside", () => {
    const spec = readSpec();
    const violations: string[] = [];

    // Repo.githubId and PullRequestComment.githubCommentId are GitHub's own
    // identifiers, not surrogates, and stay int4 by design.
    const ALLOWED = new Set(["githubId", "githubCommentId", "prNumber"]);

    const walk = (schema: unknown, path: string): void => {
      if (schema == null || typeof schema !== "object") {
        return;
      }

      const node = schema as JsonSchema & { type?: unknown };

      for (const [key, nested] of Object.entries(node.properties ?? {})) {
        const type = (nested as { type?: unknown }).type;

        if (
          (type === "number" || type === "integer") &&
          (key === "id" || key.endsWith("Id")) &&
          !ALLOWED.has(key)
        ) {
          violations.push(`${path} -> ${key} (${String(type)})`);
        }

        walk(nested, path);
      }
    };

    for (const [path, methods] of Object.entries(spec.paths ?? {})) {
      for (const operation of Object.values(methods)) {
        const response = (
          operation as {
            responses?: Record<string, { content?: Record<string, { schema?: unknown }> }>;
          }
        ).responses?.["200"];
        walk(response?.content?.["application/json"]?.schema, path);
      }
    }

    expect(violations).toEqual([]);
  });
});
