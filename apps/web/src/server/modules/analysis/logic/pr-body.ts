const START_MARKER = "<!-- DOXYNIX_START -->";
const END_MARKER = "<!-- DOXYNIX_END -->";

// Writes the summary between stable markers so re-analysis replaces it and never touches prose outside them
export function mergePrBody(existingBody: null | string, aiSummary: string): string {
  const body = existingBody ?? "";
  const formattedSummary = `${START_MARKER}\n\n${aiSummary}\n\n${END_MARKER}`;

  const startIndex = body.indexOf(START_MARKER);
  const endIndex = body.indexOf(END_MARKER);

  if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
    const before = body.slice(0, startIndex);
    const after = body.slice(endIndex + END_MARKER.length);
    return `${before}${formattedSummary}${after}`;
  }

  if (body.trim().length === 0) {
    return formattedSummary;
  }

  return `${body}\n\n---\n\n${formattedSummary}`;
}
