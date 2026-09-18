export function maskApiKey(safePrefix: string | null | undefined = ""): string {
  const placeholder = "••••••••••••••••••••••••••••••••••••••••••••••••••••";

  const prefix = safePrefix ?? "";

  if (prefix === "") {
    return `dxnx_${placeholder}`;
  }

  return `${prefix}${placeholder}`;
}
