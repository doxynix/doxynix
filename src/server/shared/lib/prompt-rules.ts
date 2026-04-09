/**
 * PromptRuleLibrary
 * Centralized collection of reusable instruction rules and constraints.
 * Eliminates repetition across all LLM prompts in the system.
 */

// =============================================================================
// GROUNDING & DATA VALIDATION RULES
// =============================================================================

export const GroundingRules = {
  /** Rule: Treat supplied data as authoritative */
  authoritative: (dataType: string = "metrics") =>
    `Treat the supplied \`${dataType}\` as authoritative. Do not contradict or override it with inferences.`,

  /** Rule: Cite only from canonical sources */
  citeOnlyCanonical: (sourceType: "file paths" | "metrics" | "entrypoints" = "file paths") =>
    `Cite only from supplied ${sourceType} or evidence. Never invent new ${sourceType}.`,

  /** Rule: Handle missing data gracefully */
  missingDataHandler: `If evidence is missing or contradictory, write "unknown" or "not enough evidence" instead of guessing.`,

  /** Rule: Never invent or fabricate information */
  noInvention: `Never invent, fabricate, or guess. If information is missing or unclear, mark it as "unknown".`,

  /** Rule: Only use supplied evidence */
  onlySuppliedEvidence: `Use only the supplied evidence and code snippets. Do not assume or infer beyond what is explicitly provided.`,

  /** Rule: Mark uncertain paths */
  pathValidation: (source: string = "allowed_repository_paths") =>
    `When mentioning files or directories, use only paths from \`${source}\`. Never invent or assume paths.`,
};

// =============================================================================
// OUTPUT FORMAT RULES
// =============================================================================

export const OutputFormatRules = {
  /** Rule: JSON-only output */
  jsonOnly: `Return ONLY a valid JSON object. No markdown formatting, no explanation.`,

  /** Rule: Markdown-only output */
  markdownOnly: `Return ONLY raw Markdown. No JSON, no code blocks, no explanation.`,

  /** Rule: No modifications to code */
  noCodeModification: `DO NOT modify the code logic. Only modify documentation. Return the complete file with no omissions.`,

  /** Rule: Structured schema compliance */
  schemaCompliance: (schemaName: string) =>
    `Return ONLY a valid JSON object matching the \`${schemaName}\` schema exactly.`,

  /** Rule: Strict XML structure */
  xmlStructure: (rootTag: string) =>
    `Wrap the output in valid XML tags: <${rootTag}>...</${rootTag}>. Escape all special characters.`,
};

// =============================================================================
// LANGUAGE & TONE RULES
// =============================================================================

export const LanguageRules = {
  /** Rule: Conciseness */
  conciseness: (maxPoints?: number) =>
    `Be concise. ${maxPoints != null ? `Focus on the most important ${maxPoints} points.` : "Avoid unnecessary details."}`,

  /** Rule: Evidence-first approach */
  evidenceFirst: `Prefer explicit evidence over intuition. If a claim cannot be proven from input, omit it or mark it as "unknown".`,

  /** Rule: Target-specific language */
  targetLanguage: (language: string = "English") =>
    `Output ALL text in **${language}**. This is non-negotiable.`,

  /** Rule: Technical tone */
  technicalTone: `Tone: Technical, concise, professional. Avoid marketing language or vague abstractions.`,
};

// =============================================================================
// BEHAVIORAL RULES
// =============================================================================

export const BehavioralRules = {
  /** Rule: Framework-aware output */
  frameworkAware: (frameworks: string[] = []) =>
    frameworks.length > 0
      ? `Adapt output for the following frameworks: ${frameworks.join(", ")}.`
      : `Infer the target framework from evidence and adapt output accordingly.`,

  /** Rule: Merge duplicates */
  mergeDuplicates: `Merge duplicate observations rather than repeating them across sections.`,

  /** Rule: No hallucination */
  noHallucination: `Never hallucinate behavior, commands, environment variables, or configuration that is not explicitly supported by the input.`,

  /** Rule: No hidden assumptions */
  noHiddenAssumptions: `Do not invent business goals, stack trade-offs, environment variables, or commands that are not supported by the input.`,

  /** Rule: Primary artifact handling */
  primaryArtifact: `This is a **primary artifact**. Prefer precise reference over broad prose. It will be delivered to users as the source of truth.`,

  /** Rule: Secondary artifact handling */
  secondaryArtifact: `This is a **secondary compatibility document**. Keep it useful, but do not behave as if it is the core product artifact.`,
};

// =============================================================================
// VERIFICATION RULES
// =============================================================================

export const VerificationRules = {
  /** Rule: Categorical clarity */
  categoricalClarity: `If evidence is weak, state so directly instead of smoothing it over with abstract language.`,

  /** Rule: Confidence-based wording */
  confidenceWording: `Use confidence-friendly wording when evidence is partial. Distinguish between "known facts", "inferred", and "unknown".`,

  /** Rule: No contradiction of metrics */
  noMetricsContradiction: `Do not contradict or override supplied metrics with inferences.`,

  /** Rule: Verify against supplied evidence */
  verifyAgainstEvidence: `Verify claims against the supplied facts before including them in the output.`,
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Combine multiple rules into a formatted section
 * Useful for building composite rule sets
 */
export function combineRules(rules: (string | undefined)[]): string {
  return rules.filter(Boolean).join("\n");
}

/**
 * Build a "do not invent" section for a specific context
 */
export function buildNoInventionSection(context: string = "information"): string {
  return `
## GROUNDING (HARD)
- **${context}**: ${GroundingRules.noInvention}
- ${GroundingRules.onlySuppliedEvidence}
- ${GroundingRules.missingDataHandler}
`;
}

/**
 * Build safety constraints section
 */
export function buildSafetyConstraints(): string {
  return `
## CONSTRAINTS
- ${BehavioralRules.noHallucination}
- ${BehavioralRules.noHiddenAssumptions}
- ${VerificationRules.verifyAgainstEvidence}
`;
}

/**
 * Build format section
 */
export function buildFormatSection(format: "json" | "markdown" | "xml"): string {
  const rule =
    format === "json"
      ? OutputFormatRules.jsonOnly
      : format === "markdown"
        ? OutputFormatRules.markdownOnly
        : OutputFormatRules.xmlStructure("output");

  return `## OUTPUT\n${rule}`;
}
