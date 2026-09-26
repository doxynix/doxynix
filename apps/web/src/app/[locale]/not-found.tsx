import { SearchX } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { createMetadata } from "@/shared/lib/metadata";
import { BackOrLinkButton } from "@/shared/ui/kit/back-or-link-button";

export const generateMetadata = createMetadata("not_found_title", "not_found_desc");

export default async function NotFound() {
  const tCommon = await getTranslations("Common");
  const t = await getTranslations("NotFound");

  return (
    <main
      className="flex flex-1 flex-col items-center justify-center gap-6 p-4 text-center"
      id="main-content"
      tabIndex={-1}
    >
      <div className="flex size-20 items-center justify-center rounded-full bg-warning/10 text-warning">
        <SearchX size={35} />
      </div>

      <div className="flex flex-col gap-2">
        <h1 className="font-bold text-4xl">{t("title")}</h1>
        <p className="text-lg text-muted-foreground">{t("sub_title")}</p>
      </div>

      <div className="flex items-center gap-4">
        <BackOrLinkButton label={tCommon("back")} />
        <BackOrLinkButton
          href="/"
          label={tCommon("home")}
        />
      </div>
      <p className="text-muted-foreground text-sm">{t("footer")}</p>
    </main>
  );
}
