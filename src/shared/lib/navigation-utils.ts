import { normalize } from "pathe";

function standardize(segment?: string) {
  if (segment == null) return segment;
  return segment.endsWith("s") ? segment.slice(0, -1) : segment;
}

export function isRouteActive(
  pathname: string,
  href: null | string | undefined,
  exact?: boolean
): boolean {
  if (href == null) return false;

  const p = normalize(pathname).split("/").filter(Boolean);
  const h = normalize(href).split("/").filter(Boolean);

  if (exact === true) return p.join("/") === h.join("/");
  if (h.length > p.length) return false;

  const isMatch = h.every((seg, i) => standardize(seg) === standardize(p[i]));
  if (!isMatch) return false;

  const isSpecificRepo = h[1] === "repo" && h.length === 4;
  if (isSpecificRepo) return true;

  const isGlobal = h.length <= 2;
  if (isGlobal) {
    if (h[1] === "repos" && p[1] === "repo") return false;

    return p.length === h.length;
  }

  return p.length - h.length <= 1;
}
