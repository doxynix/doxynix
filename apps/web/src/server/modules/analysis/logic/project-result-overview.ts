const MAX_OVERVIEW_CHARS = 4096;
const MAX_PURPOSE_CHARS = 400;
const MAX_TEXT_CHARS = 200;

const MAX_STACK_ITEMS = 12;
const MAX_FINDING_ITEMS = 5;
const MAX_VULNERABILITY_ITEMS = 3;
const MAX_FILE_ITEMS = 5;
const MAX_BOTTLENECK_ITEMS = 5;

type JsonRecord = Record<string, unknown>;

type ResultOverview = {
  architecture_style: null | string;
  counts: {
    findings: number;
    mostComplexFiles: number;
    repositoryFacts: number;
    vulnerabilities: number;
  };
  mainBottlenecks: string[];
  mostComplexFiles: string[];
  purpose: string;
  scores: {
    complexityScore: null | number;
    onboardingScore: null | number;
    securityScore: null | number;
    techDebtScore: null | number;
  };
  stack: string[];
  topFindings: Array<{
    description: string;
    file: null | string;
    risk: null | string;
    title: string;
  }>;
  topVulnerabilities: Array<{ file: null | string; risk: null | string }>;
};

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asRecord(value: unknown): JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}

function readScore(root: JsonRecord, key: string): null | number {
  const value = root[key] ?? asRecord(root["scores"])[key];

  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readText(value: unknown, maxChars = MAX_TEXT_CHARS): null | string {
  if (typeof value === "string") {
    return value.slice(0, maxChars);
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value).slice(0, maxChars);
  }

  return null;
}

function readTextList(value: unknown, maxItems: number, maxChars = MAX_TEXT_CHARS): string[] {
  return asArray(value)
    .map((item) => readText(item, maxChars))
    .filter((item): item is string => item != null)
    .slice(0, maxItems);
}

function readTopFindings(root: JsonRecord) {
  return asArray(root["findings"])
    .slice(0, MAX_FINDING_ITEMS)
    .map((item) => {
      const finding = asRecord(item);
      const evidence = asRecord(asArray(finding["evidence"])[0]);

      return {
        description:
          readText(finding["description"] ?? finding["summary"] ?? finding["whyItMatters"]) ?? "",
        file: readText(evidence["path"] ?? finding["file"]),
        risk: readText(finding["risk"] ?? finding["severity"]),
        title: readText(finding["title"]) ?? "",
      };
    });
}

function readTopVulnerabilities(root: JsonRecord) {
  return asArray(root["vulnerabilities"])
    .slice(0, MAX_VULNERABILITY_ITEMS)
    .map((item) => {
      const vulnerability = asRecord(item);

      return {
        file: readText(vulnerability["file"]),
        risk: readText(vulnerability["risk"]),
      };
    });
}

function buildOverview(root: JsonRecord): ResultOverview {
  const findings = asArray(root["findings"]);
  const vulnerabilities = asArray(root["vulnerabilities"]);
  const repositoryFacts = asArray(root["repository_facts"]);
  const mostComplexFiles = asArray(root["mostComplexFiles"]);

  return {
    architecture_style: readText(asRecord(root["executive_summary"])["architecture_style"]),
    counts: {
      findings: findings.length,
      mostComplexFiles: mostComplexFiles.length,
      repositoryFacts: repositoryFacts.length,
      vulnerabilities: vulnerabilities.length,
    },
    mainBottlenecks: readTextList(root["mainBottlenecks"], MAX_BOTTLENECK_ITEMS),
    mostComplexFiles: readTextList(mostComplexFiles, MAX_FILE_ITEMS),
    purpose: readText(asRecord(root["executive_summary"])["purpose"], MAX_PURPOSE_CHARS) ?? "",
    scores: {
      complexityScore: readScore(root, "complexityScore"),
      onboardingScore: readScore(root, "onboardingScore"),
      securityScore: readScore(root, "securityScore"),
      techDebtScore: readScore(root, "techDebtScore"),
    },
    stack: readTextList(asRecord(root["executive_summary"])["stack_details"], MAX_STACK_ITEMS),
    topFindings: readTopFindings(root),
    topVulnerabilities: readTopVulnerabilities(root),
  };
}

// Deterministic shrink order: drop findings from the end, then purpose, then the string lists.
function shrinkToLimit(overview: ResultOverview): string {
  let json = JSON.stringify(overview);
  if (json.length <= MAX_OVERVIEW_CHARS) {
    return json;
  }

  while (overview.topFindings.length > 0 && json.length > MAX_OVERVIEW_CHARS) {
    overview.topFindings.pop();
    json = JSON.stringify(overview);
  }

  while (overview.purpose.length > 0 && json.length > MAX_OVERVIEW_CHARS) {
    overview.purpose = overview.purpose.slice(0, Math.floor(overview.purpose.length / 2));
    json = JSON.stringify(overview);
  }

  for (const list of [overview.stack, overview.mostComplexFiles, overview.mainBottlenecks]) {
    while (list.length > 0 && json.length > MAX_OVERVIEW_CHARS) {
      list.pop();
      json = JSON.stringify(overview);
    }
  }

  return json;
}

export function projectResultOverview(resultJson: unknown): string {
  const root = asRecord(resultJson);
  if (Object.keys(root).length === 0) {
    return "{}";
  }

  return shrinkToLimit(buildOverview(root));
}
