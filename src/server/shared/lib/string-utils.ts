/**
 * String validation and manipulation utilities for the server layer.
 * Shared across all features and entities.
 */

/**
 * Type-safe guard for non-empty strings (including whitespace checks).
 * Useful in filter chains: `values.filter(hasText)`
 */
export function hasText(value: string | undefined | null): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * Generic string content check - same logic as hasText.
 * Alias for compatibility with existing code.
 */
export function hasContent(value: string | undefined | null): value is string {
  return hasText(value);
}

/**
 * Check if a string is empty or only whitespace.
 */
export function isEmpty(value: string | undefined | null): value is null | undefined | "" {
  return !hasText(value);
}

export function escapePromptXmlText(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

export function escapePromptXmlAttr(value: string): string {
  return escapePromptXmlText(value).replaceAll('"', "&quot;");
}
