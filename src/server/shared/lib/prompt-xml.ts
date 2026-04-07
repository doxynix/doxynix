export function escapePromptXmlText(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

export function escapePromptXmlAttr(value: string): string {
  return escapePromptXmlText(value).replaceAll('"', "&quot;");
}
