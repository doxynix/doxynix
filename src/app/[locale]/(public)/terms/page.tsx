import { getTranslations } from "next-intl/server";

import { createMetadata } from "@/shared/lib/metadata";
import { BackOrLinkButton } from "@/shared/ui/kit/back-or-link-button";

// export const runtime = "edge"; // DOCS: изучить как эта вещь работает а то ошибки какое-то не понятно...

export const generateMetadata = createMetadata("terms_title", "terms_desc");

const SECTION_TITLE = "mb-3 text-lg font-bold text-foreground flex items-center gap-2";
const LIST_STYLES = "list-disc space-y-2 pl-5 marker:text-foreground";
const STRONG_TEXT = "font-medium text-foreground";

const richStyles = {
  strong: (chunks: React.ReactNode) => <span className={STRONG_TEXT}>{chunks}</span>,
  italic: (chunks: React.ReactNode) => <i className="italic">{chunks}</i>,
};

export default async function TermsPage() {
  const tCommon = await getTranslations("Common");
  const t = await getTranslations("Terms");

  const tsRich = (key: string) => t.rich(key, richStyles);

  return (
    <div className="animate-fade-in container mx-auto max-w-3xl px-4 py-12 pt-24">
      <BackOrLinkButton
        className="cursor-pointer"
        showIcon={true}
        variant="link"
        label={tCommon("back")}
      />

      <header className="mb-10 border-b py-6">
        <h1 className="mb-3 text-3xl font-bold tracking-tight md:text-4xl"> {t("title")}</h1>
        <div className="text-muted-foreground flex items-center gap-2 text-sm">
          <span>{t("last_updated")}</span>
        </div>
      </header>

      <div className="prose prose-neutral dark:prose-invert max-w-none space-y-8 text-sm md:text-base">
        <section>
          <h2 className={SECTION_TITLE}>{t("section_acceptance_title")}</h2>
          <p className="leading-relaxed">{t("section_acceptance_content")}</p>
        </section>

        <section>
          <h2 className={SECTION_TITLE}>{t("section_usage_title")}</h2>
          <p className="mb-3">{t("section_usage_intro")}</p>
          <ul className={LIST_STYLES}>
            <li>{t("section_usage_point_1")}</li>
            <li>{t("section_usage_point_2")}</li>
            <li>{t("section_usage_point_3")}</li>
            <li>{t("section_usage_point_4")}</li>
          </ul>
        </section>

        <section>
          <h2 className={SECTION_TITLE}>{t("section_property_title")}</h2>
          <div className="bg-muted/50 rounded-xl border p-4">
            <p className="mb-2">{tsRich("section_property_your_data")}</p>
            <p>{tsRich("section_property_our_service")}</p>
          </div>
        </section>

        <section>
          <h2 className={SECTION_TITLE}>{t("section_billing_title")}</h2>
          <p>{t("section_billing_content")}</p>
        </section>

        <section>
          <h2 className={SECTION_TITLE}>{t("section_disclaimer_title")}</h2>
          <p className="mb-2 italic">{t("section_disclaimer_note")}</p>
          <div className="border-muted-foreground border-l-2 pl-4">
            <p className="mb-4">{tsRich("section_disclaimer_content_1")}</p>
            <p>{tsRich("section_disclaimer_content_2")}</p>
          </div>
        </section>

        <section>
          <h2 className={SECTION_TITLE}>{t("section_termination_title")}</h2>
          <p>{t("section_termination_content")}</p>
        </section>

        <section>
          <h2 className={SECTION_TITLE}>{t("section_contact_title")}</h2>
          <p>{t("section_contact_content")}</p>
          <div className="mt-4">
            <a
              href="mailto:legal@doxynix.space?subject=Terms of Service Inquiry"
              className="hover:no-underline"
            >
              legal@doxynix.space
            </a>
          </div>
        </section>
      </div>
    </div>
  );
}
