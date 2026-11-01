export const WS_COOKIE = "doxynix_workspace";
export const WS_HEADER = "X-Workspace-Id";

const MAX_AGE = 60 * 60 * 24 * 365;

export function getWorkspaceCookie(): string | undefined {
  if (typeof document === "undefined") {
    return undefined;
  }

  const prefix = `${WS_COOKIE}=`;
  const match = document.cookie.split("; ").find((cookie) => cookie.startsWith(prefix));

  return match?.slice(prefix.length);
}

export function setWorkspaceCookie(workspaceId: string): void {
  if (typeof document === "undefined") {
    return;
  }

  document.cookie = `${WS_COOKIE}=${encodeURIComponent(workspaceId)}; path=/; max-age=${MAX_AGE}; SameSite=Lax`;
}

export function clearWorkspaceCookie(): void {
  if (typeof document === "undefined") {
    return;
  }

  document.cookie = `${WS_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
}
