export function getSitemapUrl(
  baseUrl: string,
  path: string,
  locale: string,
  defaultLocale: string,
): string {
  const cleanBase = baseUrl.replace(/\/$/, "");
  const cleanPath = path ? (path.startsWith("/") ? path.slice(1) : path) : "";

  if (locale === defaultLocale) {
    return cleanPath ? `${cleanBase}/${cleanPath}` : cleanBase;
  }

  return cleanPath ? `${cleanBase}/${locale}/${cleanPath}` : `${cleanBase}/${locale}`;
}
