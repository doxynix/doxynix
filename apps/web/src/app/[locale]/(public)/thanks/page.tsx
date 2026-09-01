import { getTranslations } from "next-intl/server";

import rawLicenses from "@/shared/data/licenses.json";
import { BackOrLinkButton } from "@/shared/ui/kit/back-or-link-button";

import type { AuthorGroup } from "@/features/thanks/model/thanks.types";
import { ThanksList } from "@/features/thanks/ui/thanks-list";

export default async function ThanksPage() {
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

      <ThanksList initialGroups={groups} />
    </div>
  );
}
