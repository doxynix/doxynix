export function isGitHubUrl(input: string): boolean {
  const trimmed = input.trim();
  if (!trimmed) return false;

  if (trimmed.includes("://")) {
    try {
      const url = new URL(trimmed);
      const protocol = url.protocol.toLowerCase();
      if (protocol !== "http:" && protocol !== "https:") return false;

      const host = url.hostname.toLowerCase();
      const isGithubHost =
        host === "github.com" || host.endsWith(".github.com") || host.startsWith("github.");
      if (!isGithubHost) return false;

      return url.pathname.split("/").filter(Boolean).length >= 2;
    } catch {
      return false;
    }
  }

  if (trimmed.startsWith("git@github.com:")) {
    return trimmed.slice("git@github.com:".length).split("/").filter(Boolean).length === 2;
  }

  return trimmed.split("/").filter(Boolean).length === 2;
}
