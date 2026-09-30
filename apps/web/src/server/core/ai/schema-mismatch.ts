export function isSchemaMismatchError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  return (
    error.name === "AI_NoObjectGeneratedError" ||
    error.name === "AI_NoOutputGeneratedError" ||
    error.message.includes("did not match schema") ||
    error.message.includes("No object generated")
  );
}
