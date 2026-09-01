import type { LeakFinding, Severity } from "@doxynix/shared";

import type { RuleSelect } from "@/core/db/schema";

type EngineResult = {
  isSafe: boolean;
  findings: LeakFinding[];
  score: number;
  maxSeverity: Severity;
};

const SEVERITY_WEIGHTS = {
  critical: 100,
  high: 50,
  low: 10,
  medium: 25,
} as const satisfies Record<Severity, number>;

function maskSecret(secret: string): string {
  if (secret.length <= 8) {
    return "****";
  }
  return `${secret.slice(0, 4)}****${secret.slice(-4)}`;
}

type ScanRuleInput = Pick<RuleSelect, "id" | "name" | "severity" | "pattern">;

export function analyzeLogContent(content: string, activeRules: ScanRuleInput[]): EngineResult {
  const findings: LeakFinding[] = [];
  const lines = content.split("\n");
  let totalScore = 0;
  let maxSeverity: Severity = "low";

  const compiledRules = activeRules
    .map((rule) => {
      try {
        return {
          ...rule,
          regex: new RegExp(rule.pattern, "gi"),
        };
      } catch {
        return null;
      }
    })
    .filter((rule) => rule != null);

  for (let lineIdx = 0; lineIdx < lines.length; ++lineIdx) {
    const lineText = lines[lineIdx] ?? "";
    if (lineText.length === 0) {
      continue;
    }

    for (const rule of compiledRules) {
      const matches = lineText.matchAll(rule.regex);

      for (const match of matches) {
        const matchedText = match[0];
        const masked = maskSecret(matchedText);

        findings.push({
          line: lineIdx + 1,
          matchedText: `[Line ${lineIdx + 1}] ${rule.name}: ${masked}`,
          ruleId: rule.id,
          ruleName: rule.name,
          severity: rule.severity,
        });

        totalScore += SEVERITY_WEIGHTS[rule.severity];

        if (SEVERITY_WEIGHTS[rule.severity] > SEVERITY_WEIGHTS[maxSeverity]) {
          maxSeverity = rule.severity;
        }
      }
    }
  }

  return {
    findings,
    isSafe: findings.length === 0,
    maxSeverity,
    score: totalScore,
  };
}
