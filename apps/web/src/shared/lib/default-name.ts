const MAX_NAME_LENGTH = 50;

export function deriveDefaultName(email: null | string | undefined): string {
  const localPart = email?.split("@")[0]?.trim() ?? "";

  if (localPart.length === 0) {
    return "User";
  }

  return localPart.slice(0, MAX_NAME_LENGTH);
}

export function isPlaceholderName(
  name: null | string | undefined,
  email: null | string | undefined,
): boolean {
  if (name == null || name === "") {
    return true;
  }

  return name === deriveDefaultName(email);
}
