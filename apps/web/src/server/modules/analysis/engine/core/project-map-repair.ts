const PROJECT_MAP_FIELD_PATTERN =
  /,\s*"(key_decisions|language_breakdown|mermaid_graph|modules)"\s*:/u;

function parseJsonObject(value: string): null | Record<string, unknown> {
  try {
    const parsed = JSON.parse(value);
    return typeof parsed === "object" && parsed != null
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

export function parseEmbeddedProjectMap(value: unknown): null | Record<string, unknown> {
  if (typeof value !== "string") return null;

  const fieldMatch = PROJECT_MAP_FIELD_PATTERN.exec(value);
  if (fieldMatch == null) return null;

  let overview = value.slice(0, fieldMatch.index).trim();
  if (overview.endsWith('"')) {
    overview = overview.slice(0, -1).trim();
  }

  const suffix = value.slice(fieldMatch.index);

  return parseJsonObject(`{"overview":${JSON.stringify(overview)}${suffix}}`);
}

function stringValue(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value;
  if (value == null) return fallback;
  return String(value);
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => stringValue(item)).filter((item) => item.length > 0);
}

export function normalizeProjectMapKeyDecisions(value: unknown) {
  if (!Array.isArray(value)) return;
  const decisions = value.map((item, index) => {
    if (typeof item === "string") {
      return {
        consequences: "Impacts module boundaries and maintenance strategy.",
        decision: item,
        rationale: "Inferred from repository topology.",
      };
    }

    const record =
      typeof item === "object" && item != null ? (item as Record<string, unknown>) : {};
    return {
      consequences: stringValue(record.consequences, "Impacts maintainability."),
      decision: stringValue(record.decision ?? record.title, `Decision ${index + 1}`),
      rationale: stringValue(
        record.rationale ?? record.reason,
        "Inferred from repository topology."
      ),
    };
  });

  return decisions.length > 0 ? decisions : undefined;
}

export function normalizeProjectMapLanguageBreakdown(value: unknown) {
  if (typeof value !== "object" || value == null) return;
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).filter((key) => stringValue(record[key]).length > 0);

  return {
    frameworks: stringArray(record.frameworks),
    primary: stringValue(record.primary, keys[0] ?? "Unknown"),
    secondary:
      stringArray(record.secondary).length > 0 ? stringArray(record.secondary) : keys.slice(1),
  };
}
