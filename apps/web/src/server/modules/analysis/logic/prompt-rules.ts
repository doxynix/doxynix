import { dedent } from "es-toolkit";

export const GroundingRules = {
  authoritative: (dataType: string = "metrics") =>
    `Treat the supplied \`${dataType}\` as authoritative. Do not contradict or override it with inferences.`,

  citeOnlyCanonical: (sourceType: "entrypoints" | "file paths" | "metrics" = "file paths") =>
    `Cite only from supplied ${sourceType} or evidence. Never invent new ${sourceType}.`,

  missingDataHandler: (fallbackValue: string = '"UNKNOWN"') =>
    `If evidence is missing or contradictory, output ${fallbackValue} according to the expected data type instead of guessing.`,

  noInvention: `Never invent, fabricate, or guess. If information is missing or unclear, mark it as "UNKNOWN".`,

  onlySuppliedEvidence: `Use only the supplied evidence and code snippets. Do not assume or infer beyond what is explicitly provided.`,

  pathValidation: (source: string = "allowed_repository_paths") =>
    `When mentioning files, directories, or modules, use ONLY paths from \`${source}\`. Format them as [[path/to/file.ext]].`,
};

export const OutputFormatRules = {
  jsonOnly: `Return ONLY a valid JSON object. No markdown formatting outside of string values, no conversational text.`,

  markdownOnly: `Return ONLY raw Markdown. No JSON wrappers, no conversational intro/outro.`,

  noCodeModification: `DO NOT modify the code logic. Only modify documentation. Return the complete file with no omissions.`,

  schemaCompliance: (schemaName: string) =>
    `Return ONLY a valid JSON object matching the \`${schemaName}\` schema exactly. Fill arrays exhaustively.`,

  xmlStructure: (rootTag: string) =>
    `Wrap the output in valid XML tags: <${rootTag}>...</${rootTag}>. Escape all special characters.`,
};

export const LanguageRules = {
  antiFluff: dedent`
    ANTI-FLUFF POLICY (CRITICAL):
    - DO NOT use generic filler phrases (e.g., "This file is responsible for", "Overall, the system", "It is important to note").
    - DO NOT use subjective adjectives (e.g., "simple", "easy", "good", "bad"). Use objective metrics ("high cyclomatic complexity", "tightly coupled").
    - Maximize information density. Every sentence must contain a technical fact, a metric, or a specific architectural observation.
    - Focus heavily on precise, expert-level technical vocabulary to ensure accurate activation of specialized MoE experts.`,

  codeBlockTitles: dedent`
    MANDATORY CODE BLOCK TITLES:
    - Every time you output a code block (using triple backticks), you MUST explicitly specify the file path as a "title" attribute in the language fence.
    - Format: \`\`\`language title="path/to/file.ext"
    - Example:
      \`\`\`typescript title="src/vanilla.ts"
      const store = createStore(initializer);
      \`\`\``,

  conciseness: (maxPoints?: number) =>
    `Be concise. ${maxPoints != null ? `Focus on the most important ${maxPoints} points.` : "Avoid unnecessary details."}`,

  emojiStyle: dedent`
    STRUCTURAL EMOJI POLICY (CRITICAL):
    - You MUST use high-quality, professional technical emojis (e.g., 🚀, 🛠️, 📦, 👥, 🛡️, ⚙️, 📄, 🔄) EXCLUSIVELY at the very beginning of Markdown headers (H1, H2, H3) to improve visual structure and scannability.
    - Format example: "# 🚀 System Identity & Onboarding Blueprint" or "### 🐛 Fixed".
    - NEVER use inline emojis inside body paragraphs, technical sentences, or code comments.
    - Keep the body text strictly professional, clean, and dry.`,

  evidenceFirst: `Prefer explicit evidence over intuition. If a claim cannot be proven from input, omit it or mark it as "unknown".`,

  exhaustiveDetail: dedent`
    EXHAUSTIVE DETAIL POLICY:
    - Do not summarize if you can enumerate.
    - If analyzing a module, analyze ALL its core functions, not just the first one.
    - Provide deep, multi-paragraph explanations for architectural decisions and risks.`,

  githubAlerts: dedent`
    MANDATORY GITHUB ALERTS / CALLOUTS:
    - Every time you need to write a note, warning, tip, or caution, you MUST use the official GitHub-flavored markdown alert syntax. Do not write plain text warnings.
    - Format:
      > [!NOTE]
      > Useful information users should know.

      > [!WARNING]
      > Urgent info that needs immediate developer attention.
    - Allowed alert types: [!NOTE], [!TIP], [!WARNING], [!IMPORTANT], [!CAUTION].`,

  targetLanguage: (language: string = "English") =>
    `Output ALL text in **${language}**. This is non-negotiable.`,

  technicalTone: `Tone: Staff Engineer / Principal Architect. Highly analytical, objective, and data-driven.`,
};

export const BehavioralRules = {
  frameworkAware: (frameworks: string[] = []) =>
    frameworks.length > 0
      ? `Adapt output for the following frameworks: ${frameworks.join(", ")}.`
      : `Infer the target framework from evidence and adapt output accordingly.`,
  mergeDuplicates: `Merge duplicate observations rather than repeating them across sections.`,

  noHallucination: `Never hallucinate behavior, commands, environment variables, or configuration that is not explicitly supported by the input.`,

  noHiddenAssumptions: `Do not invent business goals, stack trade-offs, environment variables, or commands that are not supported by the input.`,

  primaryArtifact: `This is a **primary technical artifact**. It will be used for compliance, onboarding, and architectural audits. Precision is mandatory.`,
};

export const VerificationRules = {
  categoricalClarity: `If evidence is weak, state so directly instead of smoothing it over with abstract language.`,

  confidenceWording: `Use confidence-friendly wording when evidence is partial. Distinguish between "known facts", "inferred", and "unknown".`,

  noMetricsContradiction: `Do not contradict or override supplied metrics with inferences.`,

  verifyAgainstEvidence: `Verify claims against the supplied facts before including them in the output.`,
};

export function buildNoInventionSection(context: string = "information"): string {
  return dedent`
## GROUNDING (HARD)
- **${context}**: ${GroundingRules.noInvention}
- ${GroundingRules.onlySuppliedEvidence}
- ${GroundingRules.missingDataHandler()}
`;
}

export function buildSafetyConstraints(): string {
  return dedent`
## CONSTRAINTS
- ${BehavioralRules.noHallucination}
- ${BehavioralRules.noHiddenAssumptions}
`;
}
