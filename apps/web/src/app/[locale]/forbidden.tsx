import { Lock } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Link } from "@/shared/i18n/navigation";
import { createMetadata } from "@/shared/lib/metadata";
import { AppButton } from "@/shared/ui/core/button";

export const generateMetadata = createMetadata("forbidden_title", "forbidden_desc");

export default async function ForbiddenPage() {
  const t = await getTranslations("Error");
  return (
    <main
      className="flex h-[70dvh] w-full flex-col items-center justify-center"
      id="main-content"
      tabIndex={-1}
    >
      <div className="flex max-w-md flex-col items-center gap-6 text-center">
        <div className="flex size-20 items-center justify-center rounded-full bg-warning/10 text-warning">
          <Lock size={40} />
        </div>
        <h1 className="font-bold text-3xl tracking-tight">{t("access_denied_title")}</h1>
        <p className="text-muted-foreground">{t("access_denied_desc")}</p>
        <AppButton
          asChild
          variant="outline"
        >
          <Link href="/">{t("back_to_home")}</Link>
        </AppButton>
      </div>
    </main>
  );
}
