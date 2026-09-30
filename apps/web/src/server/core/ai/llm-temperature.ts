// Tuned for Gemini Pro/Flash, including Flash Thinking and Gemini 3.
export const LLM_TEMPERATURE_STRATEGY = {
  // Strict extraction: low temperature minimizes key/value hallucination against the
  // response JSON schema.
  classification: {
    description: "Strict extraction for repo analysis (File parsing, Imports)",
    temperature: 0.2,
    topK: 20,
    topP: 0.9,
  },

  // 0.7 keeps prose fluid without tripping Gemini's automatic RECITATION safety filter on
  // boilerplate code.
  creative: {
    description: "Professional technical writing (No hallucinations, but fluid)",
    temperature: 0.7,
    topK: 64,
    topP: 0.95,
  },

  default: {
    description: "Balanced standard",
    temperature: 0.5,
    topK: 40,
    topP: 0.9,
  },

  // Google recommends 1.0 for reasoning models; lowering it causes degraded performance,
  // looping, or infinite silent reasoning cycles.
  reasoning: {
    description: "Complex synthesis for Architecture Maps, S&R blocks, and logic planning",
    temperature: 1.0, // BUG FIXED: set to 1.0 per requirements for Reasoning models
    topK: 64, // Gemini Pro/Flash default
    topP: 0.95,
  },
} as const;

export const AI_POLICY_CONSTANTS = {
  CHARS_PER_TOKEN_RATIO: 3.5,

  // Per-file cap so a single file cannot consume the whole budget.
  FILE_TOKEN_LIMITS: {
    architect: 4000,
    writer_api: 6000,
    writer_architecture: 5000,
    writer_readme: 3500,
  },

  PR_ANALYSIS: {
    COMPLEXITY_RATIO_THRESHOLD: 2.0,
    DENSE_CHANGE_THRESHOLD: 300, // Lines
    MAX_CHANGES_PER_FILE: 1000,
    SEVERITY_THRESHOLDS: {
      CRITICAL: 9,
      HIGH: 7,
      MEDIUM: 4,
    },
  },

  TOKEN_BUDGETS: {
    architect: 210_000,
    pr_differential: 40_000,
    writer_api: 180_000,
    writer_architecture: 180_000,
    writer_readme: 150_000,
  },
} as const;

export type LLMTaskType = keyof typeof LLM_TEMPERATURE_STRATEGY;
