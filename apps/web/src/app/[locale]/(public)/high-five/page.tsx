import { getTranslations } from "next-intl/server";

import { BackOrLinkButton } from "@/shared/ui/kit/back-or-link-button";

import type { AuthorGroup } from "@/entities/high-five/model/high-five.types";

import rawLicenses from "@/features/high-five/model/licenses.json";
import { HighFiveList } from "@/features/high-five/ui/high-five-list";

export default async function HighFivePage() {
  const tCommon = await getTranslations("Common");
  const groups = rawLicenses as AuthorGroup[];

  return (
    <div className="container relative mx-auto min-h-dvh max-w-5xl animate-fade-in overflow-hidden px-4 py-12 pt-24">
      <BackOrLinkButton
        className="mb-8 cursor-pointer"
        label={tCommon("back")}
        showIcon
        variant="link"
      />
      <div className="mb-20">
        <h1 className="mb-6 font-bold text-5xl text-foreground md:text-6xl">Open Source Credits</h1>
        <p className="max-w-2xl text-lg text-text-secondary">
          Doxynix is built on the shoulders of giants. We are deeply grateful to the open-source
          community and the creators of these incredible libraries.
        </p>
      </div>

      <HighFiveList initialGroups={groups} />
    </div>
  );
}
