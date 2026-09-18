import { describe, expect, it } from "vitest";

import {
  BehavioralRules,
  buildNoInventionSection,
  buildSafetyConstraints,
  GroundingRules,
  LanguageRules,
  OutputFormatRules,
  VerificationRules,
} from "./prompt-rules";

describe("GroundingRules", () => {
  it("authoritative substitutes dataType with default metrics", () => {
    expect(GroundingRules.authoritative()).toBe(
      "Treat the supplied `metrics` as authoritative. Do not contradict or override it with inferences.",
    );
    expect(GroundingRules.authoritative("metrics JSON")).toBe(
      "Treat the supplied `metrics JSON` as authoritative. Do not contradict or override it with inferences.",
    );
  });

  it("citeOnlyCanonical substitutes sourceType with default file paths", () => {
    expect(GroundingRules.citeOnlyCanonical()).toBe(
      "Cite only from supplied file paths or evidence. Never invent new file paths.",
    );
    expect(GroundingRules.citeOnlyCanonical("entrypoints")).toBe(
      "Cite only from supplied entrypoints or evidence. Never invent new entrypoints.",
    );
  });

  it('missingDataHandler substitutes fallback with default "UNKNOWN"', () => {
    expect(GroundingRules.missingDataHandler()).toContain('output "UNKNOWN" according');
    expect(GroundingRules.missingDataHandler('"N/A"')).toContain('output "N/A" according');
  });

  it("pathValidation substitutes source with default allowed_repository_paths", () => {
    expect(GroundingRules.pathValidation()).toContain("allowed_repository_paths");
    expect(GroundingRules.pathValidation("src_paths")).toContain("`src_paths`");
    expect(GroundingRules.pathValidation()).toContain("[[path/to/file.ext]]");
  });

  it("static rules are fixed", () => {
    expect(GroundingRules.noInvention).toBe(
      'Never invent, fabricate, or guess. If information is missing or unclear, mark it as "UNKNOWN".',
    );
    expect(GroundingRules.onlySuppliedEvidence).toBe(
      "Use only the supplied evidence and code snippets. Do not assume or infer beyond what is explicitly provided.",
    );
  });
});

describe("OutputFormatRules", () => {
  it("static rules are fixed", () => {
    expect(OutputFormatRules.jsonOnly).toContain("Return ONLY a valid JSON object");
    expect(OutputFormatRules.markdownOnly).toContain("Return ONLY raw Markdown");
    expect(OutputFormatRules.noCodeModification).toContain("DO NOT modify the code logic");
  });

  it("schemaCompliance and xmlStructure substitute arguments", () => {
    expect(OutputFormatRules.schemaCompliance("ProjectSchema")).toBe(
      "Return ONLY a valid JSON object matching the `ProjectSchema` schema exactly. Fill arrays exhaustively.",
    );
    expect(OutputFormatRules.xmlStructure("root")).toContain("<root>...</root>");
  });
});

describe("LanguageRules", () => {
  it("antiFluff contains the policy", () => {
    expect(LanguageRules.antiFluff).toContain("ANTI-FLUFF POLICY (CRITICAL)");
    expect(LanguageRules.antiFluff).toContain("Maximize information density");
  });

  it("codeBlockTitles requires title= in code fences", () => {
    expect(LanguageRules.codeBlockTitles).toContain("MANDATORY CODE BLOCK TITLES");
    expect(LanguageRules.codeBlockTitles).toContain('title="path/to/file.ext"');
  });

  it("conciseness supports maxPoints and default", () => {
    expect(LanguageRules.conciseness()).toBe("Be concise. Avoid unnecessary details.");
    expect(LanguageRules.conciseness(3)).toBe("Be concise. Focus on the most important 3 points.");
  });

  it("emojiStyle and exhaustiveDetail contain policies", () => {
    expect(LanguageRules.emojiStyle).toContain("STRUCTURAL EMOJI POLICY (CRITICAL)");
    expect(LanguageRules.exhaustiveDetail).toContain("EXHAUSTIVE DETAIL POLICY");
  });

  it("evidenceFirst and technicalTone are fixed", () => {
    expect(LanguageRules.evidenceFirst).toBe(
      'Prefer explicit evidence over intuition. If a claim cannot be proven from input, omit it or mark it as "unknown".',
    );
    expect(LanguageRules.technicalTone).toBe(
      "Tone: Staff Engineer / Principal Architect. Highly analytical, objective, and data-driven.",
    );
  });

  it("githubAlerts requires GitHub alerts", () => {
    expect(LanguageRules.githubAlerts).toContain("MANDATORY GITHUB ALERTS / CALLOUTS");
    expect(LanguageRules.githubAlerts).toContain("[!NOTE]");
    expect(LanguageRules.githubAlerts).toContain("[!CAUTION]");
  });

  it("targetLanguage substitutes language with default English", () => {
    expect(LanguageRules.targetLanguage()).toBe(
      "Output ALL text in **English**. This is non-negotiable.",
    );
    expect(LanguageRules.targetLanguage("Deutsch")).toBe(
      "Output ALL text in **Deutsch**. This is non-negotiable.",
    );
  });
});

describe("BehavioralRules", () => {
  it("frameworkAware adapts to the list and default", () => {
    expect(BehavioralRules.frameworkAware(["React", "Hono"])).toBe(
      "Adapt output for the following frameworks: React, Hono.",
    );
    expect(BehavioralRules.frameworkAware()).toBe(
      "Infer the target framework from evidence and adapt output accordingly.",
    );
  });

  it("static rules are fixed", () => {
    expect(BehavioralRules.mergeDuplicates).toBe(
      "Merge duplicate observations rather than repeating them across sections.",
    );
    expect(BehavioralRules.noHallucination).toContain("Never hallucinate behavior");
    expect(BehavioralRules.noHiddenAssumptions).toContain("Do not invent business goals");
    expect(BehavioralRules.primaryArtifact).toContain("**primary technical artifact**");
  });
});

describe("VerificationRules", () => {
  it("all rules are fixed", () => {
    expect(VerificationRules.categoricalClarity).toContain("If evidence is weak");
    expect(VerificationRules.confidenceWording).toContain('"known facts"');
    expect(VerificationRules.noMetricsContradiction).toContain(
      "Do not contradict or override supplied metrics",
    );
    expect(VerificationRules.verifyAgainstEvidence).toContain(
      "Verify claims against the supplied facts",
    );
  });
});

describe("buildNoInventionSection / buildSafetyConstraints", () => {
  it("buildNoInventionSection uses context and ground rules", () => {
    const section = buildNoInventionSection("repository");

    expect(section).toContain("## GROUNDING (HARD)");
    expect(section).toContain("- **repository**: Never invent, fabricate, or guess");
    expect(section).toContain(GroundingRules.onlySuppliedEvidence);
    expect(section).toContain(GroundingRules.missingDataHandler());
  });

  it("buildNoInventionSection with default context information", () => {
    expect(buildNoInventionSection()).toContain("- **information**: Never invent");
  });

  it("buildSafetyConstraints assembles hallucination and assumption prohibitions", () => {
    const section = buildSafetyConstraints();

    expect(section).toContain("## CONSTRAINTS");
    expect(section).toContain(BehavioralRules.noHallucination);
    expect(section).toContain(BehavioralRules.noHiddenAssumptions);
  });
});
