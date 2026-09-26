import { useTranslations } from "next-intl";

export function SkipLink() {
  const t = useTranslations("Common");
  return (
    <a
      className="sr-only transition-standard focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-100 focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground focus:outline-hidden focus:ring-2 focus:ring-ring"
      href="#main-content"
    >
      {t("skip_to_content")}
    </a>
  );
}
