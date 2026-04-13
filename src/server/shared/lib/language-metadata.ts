import "server-only";

import * as languages from "linguist-languages";

const DEFAULT_LANGUAGE_COLOR = "#cccccc";

type LinguistInfo = {
  readonly color?: string;
  readonly extensions?: readonly string[];
};

const languageData = languages as Record<string, LinguistInfo | undefined>;
const knownLanguageExtensions = Array.from(
  new Set(Object.values(languageData).flatMap((language) => language?.extensions ?? []))
);

function normalizeExtension(value: string) {
  return value.startsWith(".") ? value.toLowerCase() : `.${value.toLowerCase()}`;
}

function findLanguageByExtension(extension: string) {
  const normalizedExtension = normalizeExtension(extension);
  const entry = Object.entries(languageData).find(
    ([, info]) => info?.extensions?.includes(normalizedExtension) ?? false
  );

  if (entry == null) return null;

  return {
    color: entry[1]?.color ?? null,
    name: entry[0],
  };
}

export function getKnownLanguageExtensions() {
  return knownLanguageExtensions;
}

export function getLanguageColor(languageOrExtension: null | string): string {
  if (languageOrExtension == null || languageOrExtension === "") {
    return DEFAULT_LANGUAGE_COLOR;
  }

  const directMatch = languageData[languageOrExtension];
  if (directMatch?.color != null) {
    return directMatch.color;
  }

  return findLanguageByExtension(languageOrExtension)?.color ?? DEFAULT_LANGUAGE_COLOR;
}

export function normalizeLanguageName(extension: string): string {
  return findLanguageByExtension(extension)?.name ?? extension.toUpperCase();
}
