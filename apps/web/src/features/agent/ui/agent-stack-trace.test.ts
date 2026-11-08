import { describe, expect, it } from "vitest";

import { hasStackTrace } from "./agent-stack-trace";

const STACK = `TypeError: Cannot read properties of undefined (reading 'email')
    at seedUsers (prisma/seed.ts:27:34)
    at process.processTicksAndRejections (node:internal/process/task_queues:105:5)`;

describe("hasStackTrace", () => {
  it("detects stack frames", () => {
    expect(hasStackTrace(STACK)).toBe(true);
  });

  it("ignores plain tool errors", () => {
    expect(hasStackTrace("Missing repository context.")).toBe(false);
    expect(hasStackTrace("")).toBe(false);
  });
});
