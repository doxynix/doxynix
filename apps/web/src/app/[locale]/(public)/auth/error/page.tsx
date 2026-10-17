import { LifeBuoy } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Link } from "@/shared/i18n/navigation";
import { createMetadata } from "@/shared/lib/metadata";
import { AppButton } from "@/shared/ui/core/button";

export const generateMetadata = createMetadata("auth_error_title", "auth_error_desc");

const EXPLAINED = new Set(["BANNED_USER", "EmailBanned"]);

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AuthErrorPage({ searchParams }: Readonly<Props>) {
  const t = await getTranslations("Error");
  const params = await searchParams;
  const raw = params.error;
  const code = Array.isArray(raw) ? raw[0] : raw;

  const title = code != null && EXPLAINED.has(code) ? t("banned_title") : t("auth_failed_title");
  const description =
    code != null && EXPLAINED.has(code) ? t("banned_desc") : t("auth_failed_desc");

  return (
    <main
      className="flex h-[70dvh] w-full flex-col items-center justify-center"
      id="main-content"
      tabIndex={-1}
    >
      <div className="flex max-w-md flex-col items-center gap-6 text-center">
        <div className="flex size-20 items-center justify-center rounded-full bg-warning/10 text-warning">
          <LifeBuoy size={40} />
        </div>
        <h1 className="font-bold text-3xl tracking-tight">{title}</h1>
        <p className="text-muted-foreground">{description}</p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <AppButton
            asChild
            variant="outline"
          >
            <Link href="/auth">{t("back_to_sign_in")}</Link>
          </AppButton>
          <AppButton asChild>
            <a href={`mailto:${t("support_email")}`}>{t("contact_support")}</a>
          </AppButton>
        </div>
      </div>
    </main>
  );
}
