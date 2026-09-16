/** Оставляет из имени файла аватара только безопасные для blob-пути символы. */
export const sanitizeAvatarBaseName = (name: string): string =>
  name
    .toLowerCase()
    .replace(/\.[^./]+$/, "")
    .replaceAll(/\s+/g, "-")
    .replaceAll(/[^\d._a-z-]/g, "");

const ERROR_PATTERNS = [
  ["exceeds the maximum allowed size", "settings_profile_file_too_large"],
  ["too large", "settings_profile_file_too_large"],
  ["maximumsizeinbytes", "settings_profile_file_too_large"],
  ["content type mismatch", "settings_profile_invalid_file_format"],
  ["allowedcontenttypes", "settings_profile_invalid_file_format"],
  ["unauthorized", "settings_profile_not_logged_in"],
] as const;

/** Сопоставляет сообщение об ошибке загрузки аватара с ключом перевода. */
export const resolveAvatarUploadErrorKey = (error: unknown): string => {
  const errorMessage = (error instanceof Error ? error.message : String(error)).toLowerCase();

  for (const [pattern, translationKey] of ERROR_PATTERNS) {
    if (errorMessage.includes(pattern)) {
      return translationKey;
    }
  }

  return "settings_profile_error_uploading_file";
};
