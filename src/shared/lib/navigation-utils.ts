export function normalizeRoutePath(path: string) {
  let clean = path;
  while (clean.length > 1 && clean.endsWith("/")) {
    clean = clean.slice(0, -1);
  }
  return clean === "" ? "/" : clean;
}

export function isRouteActive(
  pathname: string,
  href: null | string | undefined,
  exact?: boolean
): boolean {
  if (href == null) return false;

  const cleanPath = normalizeRoutePath(pathname);
  const cleanHref = normalizeRoutePath(href);

  if (exact === true) return cleanPath === cleanHref;
  if (!cleanPath.startsWith(cleanHref)) return false;

  if (cleanHref !== "/" && cleanPath !== cleanHref && !cleanPath.startsWith(`${cleanHref}/`)) {
    return false;
  }

  if (cleanHref === "/" && cleanPath !== "/") {
    return cleanPath.split("/").filter(Boolean).length <= 1;
  }

  const pathSegments = cleanPath.split("/").filter(Boolean);
  const hrefSegments = cleanHref.split("/").filter(Boolean);

  return pathSegments.length - hrefSegments.length <= 1;
}
