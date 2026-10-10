import * as z from "zod";

import { readLocalFileIfExists } from "@/core/fs";

import type { CreateFixInput, FindingForFix } from "./pr.types";

const FindingSchema = z.object({
  file: z.string(),
  line: z.number(),
  suggestion: z.string().optional(),
  type: z.string(),
});

const FindingsFileSchema = z.array(FindingSchema);

export type FindingsParseResult =
  | { findings: FindingForFix[]; ok: true }
  | { message: string; ok: false };

export function parseLineArg(raw: string | undefined): number {
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

export function parseFindingsFile(filePath: string): FindingsParseResult {
  const raw = readLocalFileIfExists(filePath);
  if (!raw) {
    return { message: `Findings file '${filePath}' not found.`, ok: false };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return { message: `Invalid JSON in findings file '${filePath}': ${detail}`, ok: false };
  }

  const validated = FindingsFileSchema.safeParse(parsed);
  if (!validated.success) {
    const first = validated.error.issues[0];
    const where = first?.path.length ? ` at ${first.path.join(".")}` : "";
    return {
      message: `Findings file '${filePath}' is not a valid findings array${where}: ${first?.message ?? "schema mismatch"}`,
      ok: false,
    };
  }

  return { findings: validated.data, ok: true };
}

// Findings arrive from an untrusted local file, so their contents are read and
// dropped independently: a finding whose file is missing must not block the rest.
export function collectFileContents(findings: FindingForFix[]): Record<string, string> {
  const contents: Record<string, string> = {};

  for (const finding of findings) {
    const text = readLocalFileIfExists(finding.file);
    if (text !== null) {
      contents[finding.file] = text;
    }
  }

  return contents;
}

export type SingleFindingInput = {
  file: string;
  line?: string;
  message: string;
};

export function buildSingleFinding(input: SingleFindingInput): FindingForFix[] {
  return [
    {
      file: input.file,
      line: parseLineArg(input.line),
      suggestion: input.message,
      type: "CODE_SMELL",
    },
  ];
}

export type CreateFixPayloadInput = {
  findings: FindingForFix[];
  prAnalysisId?: string;
  repoId: string;
};

// Assembles the createFix request so the command layer only gathers input and
// renders output; no payload shape is built inline.
export function buildCreateFixPayload(input: CreateFixPayloadInput): CreateFixInput {
  return {
    fileContents: collectFileContents(input.findings),
    findings: input.findings,
    prAnalysisId: input.prAnalysisId,
    repoId: input.repoId,
  };
}
