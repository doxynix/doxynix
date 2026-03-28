import { getTranslations } from "next-intl/server";

import rawLicenses from "@/shared/data/licenses.json";
import { BackOrLinkButton } from "@/shared/ui/kit/back-or-link-button";

import { ThanksList, type AuthorGroup } from "@/features/thanks";

export default async function ThanksPage() {
  const tCommon = await getTranslations("Common");
  const groups = rawLicenses as AuthorGroup[];

  return (
    <div className="animate-fade-in relative container mx-auto min-h-screen max-w-5xl overflow-hidden px-4 py-12 pt-24">
      <BackOrLinkButton
        showIcon
        label={tCommon("back")}
        variant="link"
        className="mb-8 cursor-pointer"
      />
      <div className="mb-20">
        <h1 className="text-foreground mb-6 text-5xl font-bold md:text-6xl">Open Source Credits</h1>
        <p className="text-text-secondary max-w-2xl text-lg">
          Doxynix is built on the shoulders of giants. We are deeply grateful to the open-source
          community and the creators of these incredible libraries.
        </p>
      </div>

      <ThanksList initialGroups={groups} />
    </div>
  );
}
