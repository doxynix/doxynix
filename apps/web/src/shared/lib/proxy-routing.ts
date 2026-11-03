import { API_PREFIX } from "../config/env.client";
import { DEFAULT_LOCALE, LOCALE_REGEX_STR } from "../config/locales";

const protectedRoutes = ["/dashboard"];
const authRoutes = ["/auth"];

const ANALYTICS_TUNNELS = [`${API_PREFIX}/dxnx/p`, `${API_PREFIX}/dxnx/s`];

const BYPASS_EXACT_PATHS = new Set([
  "/favicon.ico",
  "/manifest.json",
  "/manifest.webmanifest",
  "/robots.txt",
  "/sitemap.xml",
]);

const BYPASS_PREFIXES = [
  ...ANALYTICS_TUNNELS,
  "/api/webhooks",
  "/webhooks",
  "/api/auth",
  "/_axiom",
];

export function hasPathBoundary(pathname: string, prefix: string): boolean {
  if (!pathname.startsWith(prefix)) {
    return false;
  }
  const nextChar = pathname.charAt(prefix.length);
  return nextChar === "" || nextChar === "/";
}

export function isBypassRoute(pathname: string): boolean {
  if (BYPASS_EXACT_PATHS.has(pathname)) {
    return true;
  }
  if (pathname.endsWith("/vitals")) {
    return true;
  }
  return BYPASS_PREFIXES.some((prefix) => hasPathBoundary(pathname, prefix));
}

export function resolvePageRedirect(pathname: string, hasToken: boolean): string | null {
  const localeRegex = new RegExp(`^/(${LOCALE_REGEX_STR})`);
  const matchedLocale = pathname.match(localeRegex)?.[1];
  const localePrefix = matchedLocale != null ? `/${matchedLocale}` : "";
  const pathWithoutLocale = pathname.replace(localeRegex, "") || "/";

  const isProtectedRoute = protectedRoutes.some((route) =>
    hasPathBoundary(pathWithoutLocale, route),
  );
  const isAuthRoute = authRoutes.some((route) => hasPathBoundary(pathWithoutLocale, route));

  if (isProtectedRoute && !hasToken) {
    return `${localePrefix}/auth`;
  }

  if (isAuthRoute && hasToken) {
    return `${localePrefix}/dashboard`;
  }

  return null;
}

export type DocsPathDecision =
  | { pathname: string; type: "redirect" }
  | { pathname: string; type: "rewrite" };

const DOCS_PREFIX = "/docs";

export function resolveDocsPath(pathname: string): DocsPathDecision | null {
  const localeRegex = new RegExp(`^/(${LOCALE_REGEX_STR})`);
  const matchedLocale = pathname.match(localeRegex)?.[1];
  const pathWithoutLocale = pathname.replace(localeRegex, "") || "/";

  if (!hasPathBoundary(pathWithoutLocale, DOCS_PREFIX)) {
    return null;
  }

  if (matchedLocale != null) {
    return { pathname: pathWithoutLocale, type: "redirect" };
  }

  return { pathname: `/${DEFAULT_LOCALE}${pathWithoutLocale}`, type: "rewrite" };
}
