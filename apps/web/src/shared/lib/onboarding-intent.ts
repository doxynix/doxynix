import { DocType, type OnboardingIntent } from "@doxynix/shared";

const INTENT_BY_LOWER = {
  architecture: "ARCHITECTURE",
  documentation: "DOCUMENTATION",
  risks: "RISKS",
} as const satisfies Record<string, OnboardingIntent>;

export function intentToAnalyzeHref(intent: OnboardingIntent, owner: string, name: string): string {
  return `/dashboard/repo/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/analyze?onboarding=1&intent=${intent.toLowerCase()}`;
}

export function intentToDocTypes(intent: OnboardingIntent | null | undefined): DocType[] {
  if (intent === "ARCHITECTURE") {
    return [DocType.ARCHITECTURE];
  }

  if (intent === "DOCUMENTATION") {
    return [DocType.README, DocType.API];
  }

  if (intent === "RISKS") {
    return [DocType.ARCHITECTURE];
  }

  return [DocType.README];
}

export function intentToResultsPath(
  intent: OnboardingIntent | null | undefined,
  owner: string,
  name: string,
): string | null {
  if (intent == null) {
    return null;
  }

  const base = `/dashboard/repo/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`;

  if (intent === "ARCHITECTURE") {
    return `${base}/map`;
  }

  if (intent === "DOCUMENTATION") {
    return `${base}/docs`;
  }

  return base;
}

export function parseOnboardingIntent(
  value: string | string[] | undefined,
): OnboardingIntent | null {
  const raw = Array.isArray(value) ? value[0] : value;

  if (raw == null || raw.length === 0) {
    return null;
  }

  const key = raw.toLowerCase();

  if (!(key in INTENT_BY_LOWER)) {
    return null;
  }

  return INTENT_BY_LOWER[key as keyof typeof INTENT_BY_LOWER];
}
