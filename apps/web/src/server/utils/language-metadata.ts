import * as languages from "linguist-languages";

const DEFAULT_LANGUAGE_COLOR = "#cccccc";

type LinguistInfo = {
  readonly color?: string;
  readonly extensions?: readonly string[];
};

const languageByExtension = new Map<string, { color: null | string; name: string }>();

const languageData = languages as Record<string, LinguistInfo | undefined>;

for (const [name, info] of Object.entries(languageData)) {
  if (info == null || typeof info !== "object" || !("extensions" in info)) {
    continue;
  }

  for (const ext of info.extensions ?? []) {
    const normalized = ext.toLowerCase();
    if (!languageByExtension.has(normalized)) {
      languageByExtension.set(normalized, {
        color: info.color ?? null,
        name,
      });
    }
  }
}

const knownLanguageExtensions = Array.from(
  new Set(
    Object.values(languageData)
      .filter(
        (info): info is LinguistInfo =>
          info != null && typeof info === "object" && "extensions" in info
      )
      .flatMap((language) => language.extensions ?? [])
  )
);

function normalizeExtension(value: string) {
  return value.startsWith(".") ? value.toLowerCase() : `.${value.toLowerCase()}`;
}

function findLanguageByExtension(extension: string) {
  const normalizedExtension = normalizeExtension(extension);
  return languageByExtension.get(normalizedExtension) ?? null;
}

export function getKnownLanguageExtensions() {
  return [...knownLanguageExtensions];
}

export function getLanguageColor(languageOrExtension: null | string): string {
  if (languageOrExtension == null || languageOrExtension === "") {
    return DEFAULT_LANGUAGE_COLOR;
  }

  const normalized = languageOrExtension.toLowerCase().trim();

  for (const [name, info] of Object.entries(languageData)) {
    if (info == null || typeof info !== "object") {
      continue;
    }
    if (name.toLowerCase() === normalized) {
      return info.color ?? DEFAULT_LANGUAGE_COLOR;
    }
  }

  return findLanguageByExtension(normalized)?.color ?? DEFAULT_LANGUAGE_COLOR;
}

export function normalizeLanguageName(extension: string): string {
  return findLanguageByExtension(extension)?.name ?? extension.toUpperCase();
}
