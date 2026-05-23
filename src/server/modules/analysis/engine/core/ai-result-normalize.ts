import z from "zod";

import { appLogger } from "@/server/core/app-logger";

import {
  aiSchema,
  projectMapSchema,
  type AIResult,
  type ProjectMap,
} from "./analysis-result.schemas";
import {
  normalizeProjectMapKeyDecisions,
  normalizeProjectMapLanguageBreakdown,
  parseEmbeddedProjectMap,
} from "./project-map-repair";

const RISK_LEVELS = ["LOW", "MODERATE", "HIGH", "CRITICAL"] as const;
const EFFORT_LEVELS = ["LOW", "MEDIUM", "HIGH"] as const;
const TECH_DEBT_TYPES = ["CODE_SMELL", "ARCHITECTURAL_ISSUE", "DOCUMENTATION_GAP"] as const;
const FACT_CONFIDENCE = ["high", "medium", "low"] as const;
const FACT_CATEGORIES = [
  "api",
  "architecture",
  "configuration",
  "delivery",
  "ownership",
  "quality",
  "security",
  "infrastructure",
] as const;
const FINDING_CATEGORIES = [
  "architecture",
  "change-risk",
  "hotspot",
  "maintainability",
  "onboarding",
  "security",
  "performance",
] as const;

function coerceEnum<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  if (typeof value !== "string") return fallback;
  const normalized = value.toUpperCase().replaceAll(/[-\s]+/gu, "_");
  const match = allowed.find((item) => item === normalized || item === value);
  return match ?? fallback;
}

function coerceRiskLevel(value: unknown) {
  return coerceEnum(value, RISK_LEVELS, "MODERATE");
}

function coerceFactConfidence(value: unknown) {
  if (typeof value === "string") {
    const lower = value.toLowerCase();
    const match = FACT_CONFIDENCE.find((item) => item === lower);
    if (match != null) return match;
  }
  return "medium" as const;
}

function asString(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value;
  if (value == null) return fallback;
  return String(value);
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => asString(item)).filter((item) => item.length > 0);
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value != null ? (value as Record<string, unknown>) : {};
}

function normalizeDomainAnalysis(value: unknown) {
  if (typeof value !== "object" || value == null) return;
  const record = value as Record<string, unknown>;
  const business_rules = asStringArray(record.business_rules);

  const rawEntities = record.core_entities;
  const core_entities = Array.isArray(rawEntities)
    ? rawEntities
        .map((item) => {
          const ent = asRecord(item);
          return {
            logic_complexity: coerceEnum(
              ent.logic_complexity ?? ent.complexity,
              ["LOW", "MEDIUM", "HIGH"] as const,
              "MEDIUM" as const
            ),
            name: asString(ent.name, "CoreEntity"),
            responsibility: asString(
              ent.responsibility ?? ent.description,
              "Domain responsibility"
            ),
          };
        })
        .filter((ent) => ent.name.length > 0)
    : [];

  return { business_rules, core_entities };
}

function normalizeRefactoringTargets(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item, index) => {
      const record = asRecord(item);
      return {
        description: asString(
          record.description ?? record.summary ?? record.issue,
          `Refactoring target ${index + 1}`
        ),
        file: asString(record.file ?? record.path ?? record.location, "unknown"),
        impact_on_health:
          typeof record.impact_on_health === "number" ? record.impact_on_health : undefined,
        improved_code: asString(record.improved_code ?? record.proposed_code) || undefined,
        issue_category: asString(record.issue_category ?? record.category) || undefined,
        original_code: asString(record.original_code ?? record.current_code) || undefined,
        priority: coerceEnum(
          record.priority,
          ["HIGH", "MEDIUM", "LOW"] as const,
          "MEDIUM" as const
        ),
      };
    })
    .filter((target) => target.file !== "unknown");
}

export const aiGenerationSchema = z
  .object({
    analysisRuntime: z.unknown().optional(),
    complexityScore: z.coerce.number().optional(),
    domain_analysis: z.unknown().optional(),
    executive_summary: z
      .object({
        architecture_style: z.string().optional(),
        key_innovations: z.array(z.string()).optional(),
        purpose: z.string().optional(),
        stack_details: z.array(z.string()).optional(),
      })
      .optional(),
    findings: z.array(z.unknown()).optional(),
    mainBottlenecks: z.array(z.string()).optional(),
    mostComplexFiles: z.array(z.string()).optional(),
    onboarding_guide: z
      .object({
        prerequisites: z.array(z.string()).optional(),
        setup_steps: z.array(z.string()).optional(),
      })
      .optional(),
    onboardingScore: z.coerce.number().optional(),
    refactoring_targets: z.array(z.unknown()).optional(),
    repository_facts: z.array(z.unknown()).optional(),
    sections: z
      .object({
        api_structure: z.string().optional(),
        data_flow: z.string().optional(),
        infrastructure_and_scaling: z.unknown().optional(),
        performance_audit: z.array(z.unknown()).optional(),
        security_audit: z
          .object({
            attack_surface_analysis: z.string().optional(),
            risks: z.array(z.string()).optional(),
            score: z.coerce.number().optional(),
          })
          .optional(),
        tech_debt_inventory: z.array(z.unknown()).optional(),
      })
      .optional(),
    securityScore: z.coerce.number().optional(),
    swaggerYaml: z.string().optional(),
    techDebtScore: z.coerce.number().optional(),
    vulnerabilities: z.array(z.unknown()).optional(),
  })
  .loose();

export const projectMapGenerationSchema = z
  .object({
    key_decisions: z.array(z.unknown()).optional(),
    language_breakdown: z.unknown().optional(),
    mermaid_graph: z.string().optional(),
    modules: z.array(z.unknown()).optional(),
    overview: z.string().optional(),
  })
  .loose();

function normalizeEvidenceRefs(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item !== "object" || item == null) return null;
      const record = item as Record<string, unknown>;
      const path = asString(record.path);
      if (path.length === 0) return null;
      return {
        ...record,
        line:
          typeof record.line === "number" && Number.isFinite(record.line)
            ? Math.max(1, Math.trunc(record.line))
            : undefined,
        path,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item != null);
}

function normalizeFindings(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item, index) => {
      if (typeof item !== "object" || item == null) return null;
      const record = item as Record<string, unknown>;
      const title = asString(record.title, `Finding ${index + 1}`);
      return {
        category: coerceEnum(record.category, FINDING_CATEGORIES, "maintainability"),
        confidence:
          typeof record.confidence === "number"
            ? Math.min(100, Math.max(0, record.confidence))
            : 50,
        effort_to_fix: record.effort_to_fix,
        evidence: normalizeEvidenceRefs(record.evidence),
        id: asString(record.id, `finding-${index + 1}`),
        remediation_plan: asStringArray(record.remediation_plan),
        risk_of_regression: record.risk_of_regression,
        score: typeof record.score === "number" ? Math.min(100, Math.max(0, record.score)) : 50,
        semibold: coerceRiskLevel(record.severity),
        severity: coerceRiskLevel(record.severity),
        suggestedNextChange: asString(record.suggestedNextChange, "Review and refactor"),
        summary: asString(record.summary, title),
        title,
        whyItMatters: asString(record.whyItMatters, "Impacts maintainability or delivery risk."),
      };
    })
    .filter((item): item is NonNullable<typeof item> => item != null);
}

function normalizeFacts(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item, index) => {
      if (typeof item !== "object" || item == null) return null;
      const record = item as Record<string, unknown>;
      const title = asString(record.title, `Fact ${index + 1}`);
      return {
        category: coerceEnum(record.category, FACT_CATEGORIES, "architecture"),
        confidence: coerceFactConfidence(record.confidence),
        detail: asString(record.detail, title),
        evidence: normalizeEvidenceRefs(record.evidence),
        id: asString(record.id, `fact-${index + 1}`),
        impact_area: asString(record.impact_area),
        title,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item != null);
}

function normalizePerformanceAudit(value: unknown) {
  if (!Array.isArray(value)) return;
  return value.map((item, index) => {
    const record = asRecord(item);
    const issue = asString(
      record.issue ?? record.title ?? record.description,
      `Performance issue ${index + 1}`
    );
    return {
      impact: asString(record.impact ?? record.risk, "Potential runtime or scalability impact."),
      issue,
      location: asString(record.location ?? record.file ?? record.path, "Repository"),
      optimization_strategy: asString(
        record.optimization_strategy ?? record.recommendation ?? record.suggestion,
        "Inspect the hotspot and apply a targeted optimization."
      ),
    };
  });
}
function normalizeTechDebtInventory(value: unknown) {
  if (!Array.isArray(value)) return;
  return value.map((item, index) => {
    const record = asRecord(item);
    return {
      description: asString(
        record.description ?? record.issue ?? record.summary,
        `Technical debt item ${index + 1}`
      ),
      remediation_effort: coerceEnum(
        record.remediation_effort ?? record.effort,
        EFFORT_LEVELS,
        "MEDIUM"
      ),
      type: coerceEnum(record.type ?? record.category, TECH_DEBT_TYPES, "CODE_SMELL"),
    };
  });
}
function normalizeVulnerabilities(value: unknown) {
  if (!Array.isArray(value)) return;
  return value.map((item, index) => {
    const record = asRecord(item);
    return {
      description: asString(
        record.description ?? record.issue ?? record.title,
        `Security finding ${index + 1}`
      ),
      file: asString(record.file ?? record.path ?? record.location, "unknown"),
      lineHint: asString(record.lineHint ?? record.line) || undefined,
      risk: coerceRiskLevel(record.risk ?? record.severity),
      suggestion: asString(
        record.suggestion ?? record.recommendation,
        "Review and remediate the finding."
      ),
    };
  });
}

export function normalizeAiGenerationOutput(raw: unknown): AIResult {
  const rawRecord = typeof raw === "object" && raw != null ? (raw as Record<string, unknown>) : {};

  const rawExecSummary =
    typeof rawRecord.executive_summary === "object" && rawRecord.executive_summary != null
      ? (rawRecord.executive_summary as Record<string, unknown>)
      : null;

  const rawOnboarding =
    typeof rawRecord.onboarding_guide === "object" && rawRecord.onboarding_guide != null
      ? (rawRecord.onboarding_guide as Record<string, unknown>)
      : null;

  const rawSections =
    typeof rawRecord.sections === "object" && rawRecord.sections != null
      ? (rawRecord.sections as Record<string, unknown>)
      : null;

  const rawSecurity =
    rawSections != null &&
    typeof rawSections.security_audit === "object" &&
    rawSections.security_audit != null
      ? (rawSections.security_audit as Record<string, unknown>)
      : null;

  const candidate = {
    ...rawRecord,
    analysisRuntime: undefined,
    domain_analysis: normalizeDomainAnalysis(rawRecord.domain_analysis),
    executive_summary: {
      architecture_style: asString(
        rawExecSummary?.architecture_style,
        "Layered application architecture"
      ),
      key_innovations: asStringArray(rawExecSummary?.key_innovations),
      purpose: asString(rawExecSummary?.purpose, "Automated repository intelligence report"),
      stack_details: asStringArray(rawExecSummary?.stack_details),
    },
    findings: normalizeFindings(rawRecord.findings),
    onboarding_guide: {
      prerequisites: asStringArray(rawOnboarding?.prerequisites),
      setup_steps: asStringArray(rawOnboarding?.setup_steps),
    },
    refactoring_targets: normalizeRefactoringTargets(rawRecord.refactoring_targets),
    repository_facts: normalizeFacts(rawRecord.repository_facts),
    sections: (() => {
      const infrastructure = asRecord(rawSections?.infrastructure_and_scaling);
      return {
        api_structure: asString(
          rawSections?.api_structure,
          "API surface documented from static scan."
        ),
        data_flow: asString(rawSections?.data_flow, "Data flow inferred from module boundaries."),
        infrastructure_and_scaling:
          Object.keys(infrastructure).length === 0
            ? undefined
            : {
                bottlenecks: asStringArray(infrastructure.bottlenecks),
                concurrency_risks: asStringArray(infrastructure.concurrency_risks),
                statelessness_check: asString(infrastructure.statelessness_check, "Not assessed"),
              },
        performance_audit: normalizePerformanceAudit(rawSections?.performance_audit),
        security_audit: {
          attack_surface_analysis: asString(rawSecurity?.attack_surface_analysis),
          risks: asStringArray(rawSecurity?.risks),
          score:
            typeof rawSecurity?.score === "number"
              ? Math.min(10, Math.max(0, rawSecurity.score))
              : 5,
        },
        tech_debt_inventory: normalizeTechDebtInventory(rawSections?.tech_debt_inventory),
      };
    })(),
    vulnerabilities: normalizeVulnerabilities(rawRecord.vulnerabilities),
  };

  const parsed = aiSchema.safeParse(candidate);
  if (parsed.success) return parsed.data;

  appLogger.warn({
    error: z.treeifyError(parsed.error),
    msg: "ai_result_normalize_fallback_partial",
  });

  return aiSchema.parse({
    ...candidate,
    findings: [],
    refactoring_targets: [],
    repository_facts: [],
  });
}

export function normalizeProjectMapOutput(raw: unknown): ProjectMap {
  const baseRecord = typeof raw === "object" && raw != null ? (raw as Record<string, unknown>) : {};
  const embeddedRecord = parseEmbeddedProjectMap(baseRecord.overview);
  const record = embeddedRecord == null ? baseRecord : { ...baseRecord, ...embeddedRecord };
  const modules = Array.isArray(record.modules)
    ? record.modules
        .map((item) => {
          if (typeof item !== "object" || item == null) return null;

          const mod = item as Record<string, unknown>;
          const path = asString(mod.path);
          if (path.length === 0) return null;
          return {
            churn_score: typeof mod.churn_score === "number" ? mod.churn_score : undefined,
            complexity_index:
              typeof mod.complexity_index === "number" ? mod.complexity_index : undefined,
            dependencies: asStringArray(mod.dependencies),
            external_integrations: asStringArray(mod.external_integrations),
            path,
            publicExports: asStringArray(mod.publicExports),
            responsibility: asString(mod.responsibility, "Module responsibilities pending"),
            type: asString(mod.type, "module"),
          };
        })
        .filter((item): item is NonNullable<typeof item> => item != null)
    : [];

  const candidate = {
    key_decisions: normalizeProjectMapKeyDecisions(record.key_decisions),
    language_breakdown: normalizeProjectMapLanguageBreakdown(record.language_breakdown),
    mermaid_graph: asString(record.mermaid_graph) || undefined,
    modules,
    overview: asString(record.overview, "Repository topology map"),
  };

  const parsed = projectMapSchema.safeParse(candidate);
  if (parsed.success) return parsed.data;

  appLogger.warn({
    error: z.treeifyError(parsed.error),
    msg: "project_map_normalize_fallback",
  });

  return {
    modules,
    overview: asString(record.overview, "Repository topology map"),
  };
}

export function isSchemaMismatchError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return (
    error.name === "AI_NoObjectGeneratedError" ||
    error.message.includes("did not match schema") ||
    error.message.includes("No object generated")
  );
}
