import { normalizeLanguageName } from "@/server/utils/language-metadata";

export function linguistStyleLabel(filePath: string, fallbackName: string): string {
  const extMatch = /(\.[^./\\]+)$/u.exec(filePath);
  const ext = extMatch?.[1] ?? "";
  return normalizeLanguageName(ext) || fallbackName;
}
