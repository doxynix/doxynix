import type { Metadata } from "next";
import { SearchX } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { BackOrLinkButton } from "@/shared/ui/kit/back-or-link-button";

export const metadata: Metadata = {
  title: "404",
};

export default async function NotFound() {
  const tCommon = await getTranslations("Common");
  const t = await getTranslations("NotFound");

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 p-4 text-center">
      <div className="bg-warning/10 text-warning flex size-20 items-center justify-center rounded-full">
        <SearchX size={35} className="animate-pulse" />
      </div>

      <div className="flex flex-col gap-2">
        <h1 className="text-4xl font-bold">{t("title")}</h1>
        <p className="text-muted-foreground text-lg">{t("sub_title")}</p>
      </div>

      <div className="flex items-center gap-4">
        <BackOrLinkButton label={tCommon("back")} className="cursor-pointer" />
        <BackOrLinkButton href="/" label={tCommon("home")} />
      </div>
      <p className="text-muted-foreground text-sm">{t("footer")}</p>
    </div>
  );
}
