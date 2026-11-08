const FALLBACK = "/dashboard";
// Throwaway origin: only the path of a URL that resolves onto it is kept. `new URL` folds `//host`,
// `\host` and tab/newline variants into an absolute URL, which the origin check then rejects.
const INTERNAL_ORIGIN = "https://internal.invalid";

export function safeInternalPath(value: string | string[] | undefined): string {
  if (typeof value !== "string" || !value.startsWith("/")) {
    return FALLBACK;
  }

  try {
    const url = new URL(value, INTERNAL_ORIGIN);
    return url.origin === INTERNAL_ORIGIN ? `${url.pathname}${url.search}${url.hash}` : FALLBACK;
  } catch {
    return FALLBACK;
  }
}

export function isPathname(href: string, pathname: string): boolean {
  try {
    return new URL(href, INTERNAL_ORIGIN).pathname === pathname;
  } catch {
    return false;
  }
}
