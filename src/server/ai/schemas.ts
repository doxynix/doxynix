import z from "zod";

const RiskLevel = z.enum(["LOW", "MODERATE", "HIGH", "CRITICAL"]);

// --- Project Map ---
export const projectMapSchema = z.object({
  overview: z.string(),
  mermaid_graph: z.string().optional(),
  language_breakdown: z
    .object({
      primary: z.string(),
      frameworks: z.array(z.string()),
    })
    .optional(),
  modules: z.array(
    z.object({
      path: z.string(),
      type: z.string(),
      responsibility: z.string(),
      publicExports: z.array(z.string()).optional(),
      dependencies: z.array(z.string()).optional(),
    })
  ),
});

// --- Sentinel ---
export const sentinelSchema = z.object({
  status: z.enum(["SAFE", "UNSAFE"]),
  reason: z.string().optional(),
});

// --- AI Analysis ---
export const aiSchema = z.object({
  executive_summary: z.object({
    purpose: z.string(),
    stack_details: z.array(z.string()),
    architecture_style: z.string(),
  }),

  sections: z.object({
    data_flow: z.string(),
    security_audit: z.object({
      score: z.number().min(0).max(10),
      risks: z.array(z.string()),
    }),
    tech_debt: z.array(z.string()),
    performance: z.array(z.string()),
    api_structure: z.string(),
  }),

  onboarding_guide: z.object({
    prerequisites: z.array(z.string()),
    setup_steps: z.array(z.string()),
  }),

  refactoring_targets: z
    .array(
      z.object({
        file: z.string(),
        priority: z.enum(["HIGH", "MEDIUM", "LOW"]),
        description: z.string(),
        original_code: z.string().optional(),
        improved_code: z.string().optional(),
      })
    )
    .max(5),

  complexityScore: z.number().optional(),
  techDebtScore: z.number().optional(),
  onboardingScore: z.number().optional(),
  securityScore: z.number().optional(),

  mostComplexFiles: z.array(z.string()).optional(),
  mainBottlenecks: z.array(z.string()).optional(),
  vulnerabilities: z
    .array(
      z.object({
        file: z.string(),
        lineHint: z.string().optional(),
        risk: RiskLevel,
        description: z.string(),
        suggestion: z.string(),
      })
    )
    .optional(),

  generatedReadme: z.string().optional(),
  generatedApiMarkdown: z.string().optional(),
  generatedContributing: z.string().optional(),
  generatedChangelog: z.string().optional(),
  generatedArchitecture: z.string().optional(),
  swaggerYaml: z.string().optional(),
});

export type AIResult = z.infer<typeof aiSchema>;
export type ProjectMap = z.infer<typeof projectMapSchema>;
export type SentinelResult = z.infer<typeof sentinelSchema>;
