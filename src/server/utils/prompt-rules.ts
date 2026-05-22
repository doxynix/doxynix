/**
 * PromptRuleLibrary
 * Centralized collection of reusable instruction rules and constraints.
 * Eliminates repetition across all LLM prompts in the system.
 */

import dedent from "ts-dedent";

// =============================================================================
// GROUNDING & DATA VALIDATION RULES
// =============================================================================

export const GroundingRules = {
  /** Rule: Treat supplied data as authoritative */
  authoritative: (dataType: string = "metrics") =>
    `Treat the supplied \`${dataType}\` as authoritative. Do not contradict or override it with inferences.`,

  /** Rule: Cite only from canonical sources */
  citeOnlyCanonical: (sourceType: "entrypoints" | "file paths" | "metrics" = "file paths") =>
    `Cite only from supplied ${sourceType} or evidence. Never invent new ${sourceType}.`,

  /** Rule: Handle missing data gracefully */
  missingDataHandler: (fallbackValue: string = '"UNKNOWN"') =>
    `If evidence is missing or contradictory, output ${fallbackValue} according to the expected data type instead of guessing.`,

  /** Rule: Never invent or fabricate information */
  noInvention: `Never invent, fabricate, or guess. If information is missing or unclear, mark it as "UNKNOWN".`,

  /** Rule: Only use supplied evidence */
  onlySuppliedEvidence: `Use only the supplied evidence and code snippets. Do not assume or infer beyond what is explicitly provided.`,

  /** Rule: Mark uncertain paths */
  pathValidation: (source: string = "allowed_repository_paths") =>
    `When mentioning files, directories, or modules, use ONLY paths from \`${source}\`. Format them as [[path/to/file.ext]].`,
};

// =============================================================================
// OUTPUT FORMAT RULES
// =============================================================================

export const OutputFormatRules = {
  /** Rule: JSON-only output */
  jsonOnly: `Return ONLY a valid JSON object. No markdown formatting outside of string values, no conversational text.`,

  /** Rule: Markdown-only output */
  markdownOnly: `Return ONLY raw Markdown. No JSON wrappers, no conversational intro/outro.`,

  /** Rule: No modifications to code */
  noCodeModification: `DO NOT modify the code logic. Only modify documentation. Return the complete file with no omissions.`,

  /** Rule: Structured schema compliance */
  schemaCompliance: (schemaName: string) =>
    `Return ONLY a valid JSON object matching the \`${schemaName}\` schema exactly. Fill arrays exhaustively.`,

  /** Rule: Strict XML structure */
  xmlStructure: (rootTag: string) =>
    `Wrap the output in valid XML tags: <${rootTag}>...</${rootTag}>. Escape all special characters.`,
};

// =============================================================================
// LANGUAGE, TONE & ANTI-FLUFF RULES (ENTERPRISE GRADE)
// =============================================================================

export const LanguageRules = {
  antiFluff: dedent`
    ANTI-FLUFF POLICY (CRITICAL):
    - DO NOT use generic filler phrases (e.g., "This file is responsible for", "Overall, the system", "It is important to note").
    - DO NOT use subjective adjectives (e.g., "simple", "easy", "good", "bad"). Use objective metrics ("high cyclomatic complexity", "tightly coupled").
    - Maximize information density. Every sentence must contain a technical fact, a metric, or a specific architectural observation.`,

  /** Rule: Code Block title */
  codeBlockTitles: dedent`
    MANDATORY CODE BLOCK TITLES:
    - Every time you output a code block (using triple backticks), you MUST explicitly specify the file path as a "title" attribute in the language fence.
    - Format: \`\`\`language title="path/to/file.ext"
    - Example:
      \`\`\`typescript title="src/vanilla.ts"
      const store = createStore(initializer);
      \`\`\``,

  /** Rule: Conciseness */
  conciseness: (maxPoints?: number) =>
    `Be concise. ${maxPoints != null ? `Focus on the most important ${maxPoints} points.` : "Avoid unnecessary details."}`,

  /** Rule: Emoji */
  emojiStyle: dedent`
    STRUCTURAL EMOJI POLICY (CRITICAL):
    - You MUST use high-quality, professional technical emojis (e.g., 🚀, 🛠️, 📦, 👥, 🛡️, ⚙️, 📄, 🔄) EXCLUSIVELY at the very beginning of Markdown headers (H1, H2, H3) to improve visual structure and scannability.
    - Format example: "# 🚀 System Identity & Onboarding Blueprint" or "### 🐛 Fixed".
    - NEVER use inline emojis inside body paragraphs, technical sentences, or code comments.
    - Keep the body text strictly professional, clean, and dry.`,

  /** Rule: Evidence-first approach */
  evidenceFirst: `Prefer explicit evidence over intuition. If a claim cannot be proven from input, omit it or mark it as "unknown".`,

  exhaustiveDetail: dedent`
    EXHAUSTIVE DETAIL POLICY:
    - Do not summarize if you can enumerate.
    - If analyzing a module, analyze ALL its core functions, not just the first one.
    - Provide deep, multi-paragraph explanations for architectural decisions and risks.`,

  /** Rule: GitHub Alerts */
  githubAlerts: dedent`
    MANDATORY GITHUB ALERTS / CALLOUTS:
    - Every time you need to write a note, warning, tip, or caution, you MUST use the official GitHub-flavored markdown alert syntax. Do not write plain text warnings.
    - Format:
      > [!NOTE]
      > Useful information users should know.

      > [!WARNING]
      > Urgent info that needs immediate developer attention.
    - Allowed alert types: [!NOTE], [!TIP], [!WARNING], [!IMPORTANT], [!CAUTION].`,

  /** Rule: Target-specific language */
  targetLanguage: (language: string = "English") =>
    `Output ALL text in **${language}**. This is non-negotiable.`,

  /** Rule: Technical tone */
  technicalTone: `Tone: Staff Engineer / Principal Architect. Highly analytical, objective, and data-driven.`,
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
  primaryArtifact: `This is a **primary technical artifact**. It will be used for compliance, onboarding, and architectural audits. Precision is mandatory.`,
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
 * Build a "do not invent" section for a specific context
 */
export function buildNoInventionSection(context: string = "information"): string {
  return dedent`
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
  return dedent`
## CONSTRAINTS
- ${BehavioralRules.noHallucination}
- ${BehavioralRules.noHiddenAssumptions}
`;
}
