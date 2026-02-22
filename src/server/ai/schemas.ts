import z from "zod";

const RiskLevel = z.enum(["LOW", "MODERATE", "HIGH", "CRITICAL"]);

// --- Project Map ---
export const projectMapSchema = z.object({
  language_breakdown: z
    .object({
      frameworks: z.array(z.string()),
      primary: z.string(),
    })
    .optional(),
  mermaid_graph: z.string().optional(),
  modules: z.array(
    z.object({
      dependencies: z.array(z.string()).optional(),
      path: z.string(),
      publicExports: z.array(z.string()).optional(),
      responsibility: z.string(),
      type: z.string(),
    })
  ),
  overview: z.string(),
});

// --- Sentinel ---
export const sentinelSchema = z.object({
  reason: z.string().optional(),
  status: z.enum(["SAFE", "UNSAFE"]),
});

// --- AI Analysis ---
export const aiSchema = z.object({
  complexityScore: z.number().optional(),

  executive_summary: z.object({
    architecture_style: z.string(),
    purpose: z.string(),
    stack_details: z.array(z.string()),
  }),

  generatedApiMarkdown: z.string().optional(),

  generatedArchitecture: z.string().optional(),

  generatedChangelog: z.string().optional(),
  generatedContributing: z.string().optional(),
  generatedReadme: z.string().optional(),
  mainBottlenecks: z.array(z.string()).optional(),

  mostComplexFiles: z.array(z.string()).optional(),
  onboarding_guide: z.object({
    prerequisites: z.array(z.string()),
    setup_steps: z.array(z.string()),
  }),
  onboardingScore: z.number().optional(),

  refactoring_targets: z
    .array(
      z.object({
        description: z.string(),
        file: z.string(),
        improved_code: z.string().optional(),
        original_code: z.string().optional(),
        priority: z.enum(["HIGH", "MEDIUM", "LOW"]),
      })
    )
    .max(5),
  sections: z.object({
    api_structure: z.string(),
    data_flow: z.string(),
    performance: z.array(z.string()),
    security_audit: z.object({
      risks: z.array(z.string()),
      score: z.number().min(0).max(10),
    }),
    tech_debt: z.array(z.string()),
  }),
  securityScore: z.number().optional(),
  swaggerYaml: z.string().optional(),
  techDebtScore: z.number().optional(),
  vulnerabilities: z
    .array(
      z.object({
        description: z.string(),
        file: z.string(),
        lineHint: z.string().optional(),
        risk: RiskLevel,
        suggestion: z.string(),
      })
    )
    .optional(),
});

export type AIResult = z.infer<typeof aiSchema>;
export type ProjectMap = z.infer<typeof projectMapSchema>;
export type SentinelResult = z.infer<typeof sentinelSchema>;
