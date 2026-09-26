import { getTranslations } from "next-intl/server";

import { createMetadata } from "@/shared/lib/metadata";
import { BackOrLinkButton } from "@/shared/ui/kit/back-or-link-button";

import type { AuthorGroup } from "@/entities/high-five/model/high-five.types";

import rawLicenses from "@/features/high-five/model/licenses.json";
import { HighFiveList } from "@/features/high-five/ui/high-five-list";

export const generateMetadata = createMetadata("high_five_title", "high_five_desc");

export default async function HighFivePage() {
  const tCommon = await getTranslations("Common");
  const t = await getTranslations("HighFive");
  const groups = rawLicenses as AuthorGroup[];

  return (
    <div className="container relative mx-auto min-h-dvh max-w-5xl animate-fade-in overflow-hidden px-4 py-12 pt-24">
      <BackOrLinkButton
        className="mb-8"
        label={tCommon("back")}
        showIcon
        variant="link"
      />
      <div className="mb-20">
        <h1 className="mb-6 font-bold text-5xl text-foreground md:text-6xl">{t("page_title")}</h1>
        <p className="max-w-2xl text-lg text-text-secondary">{t("page_desc")}</p>
      </div>

      <HighFiveList initialGroups={groups} />
    </div>
  );
}
