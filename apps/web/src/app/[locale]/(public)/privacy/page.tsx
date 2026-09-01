import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";

import { createMetadata } from "@/shared/lib/metadata";
import { BackOrLinkButton } from "@/shared/ui/kit/back-or-link-button";

export const generateMetadata = createMetadata("privacy_title", "privacy_desc");

type Props = { descKey: string; name: string };

const SECTION_TITLE = "mb-3 text-lg font-bold text-foreground flex items-center gap-2";
const LIST_STYLES = "list-disc flex flex-col gap-2 pl-5 marker:text-foreground";
const STRONG_TEXT = "font-medium text-foreground";
const LI_STYLES = "flex flex-col";
const SPAN_STYLES = "text-sm";

const BRANDS = [
  { descKey: "brands_vercel_desc", name: "Vercel" },
  { descKey: "brands_neon_desc", name: "Neon (PostgreSQL)" },
  { descKey: "brands_resend_desc", name: "Resend" },
  { descKey: "brands_oauth_desc", name: "OAuth Providers" },
  { descKey: "brands_upstash_desc", name: "Upstash / Redis" },
  { descKey: "brands_axiom_desc", name: "Axiom" },
  { descKey: "brands_ably_desc", name: "Ably" },
] as const satisfies readonly Props[];

function PrivacyListItem({ descKey, name }: Readonly<Props>) {
  return (
    <li className={LI_STYLES}>
      <span className={STRONG_TEXT}>{name}</span>
      <span className={SPAN_STYLES}>{descKey}</span>
    </li>
  );
}

const richStyles = {
  important: (chunks: ReactNode) => <span className="font-medium text-destructive">{chunks}</span>,
  strong: (chunks: ReactNode) => <span className={STRONG_TEXT}>{chunks}</span>,
  u: (chunks: ReactNode) => <u>{chunks}</u>,
};

export default async function PrivacyPage() {
  const tCommon = await getTranslations("Common");
  const t = await getTranslations("Privacy");

  const tsRich = (key: string) => t.rich(key, richStyles);

  return (
    <div className="container mx-auto max-w-3xl animate-fade-in px-4 py-12 pt-24">
      <BackOrLinkButton
        className="mb-4 cursor-pointer"
        label={tCommon("back")}
        showIcon
        variant="link"
      />

      <div className="mb-12 border-b border-b-foreground py-6">
        <h1 className="mb-4 font-bold text-4xl text-foreground md:text-5xl">{t("title")}</h1>
        <div className="flex items-center gap-2 text-sm text-text-secondary">
          <span>{t("effective_date")}</span>
        </div>
      </div>

      <div className="prose prose-neutral dark:prose-invert flex max-w-none flex-col gap-8 text-sm md:text-base">
        <section>
          <h2 className={SECTION_TITLE}>{t("section_introduction_title")}</h2>
          <p className="leading-relaxed">{t("section_rights_desc")}</p>
        </section>

        <section>
          <h2 className={SECTION_TITLE}>{t("section_data_title")}</h2>
          <ul className={LIST_STYLES}>
            <li>{tsRich("section_data_account")}</li>
            <li>{tsRich("section_data_technical")}</li>
            <li>
              <p>{tsRich("section_data_source_code")}</p>
            </li>
          </ul>
          <p>{tsRich("section_data_important")}</p>
        </section>

        <section>
          <h2 className={SECTION_TITLE}>{t("section_usage_title")}</h2>
          <ul className={LIST_STYLES}>
            <li>{t("section_usage_point_1")}</li>
            <li>{t("section_usage_point_2")}</li>
            <li>{t("section_usage_point_3")}</li>
          </ul>
        </section>

        <section>
          <h2 className={SECTION_TITLE}>{t("section_third_party_title")}</h2>
          <p className="mb-3">{t("section_third_party_desc")}</p>
          <div className="rounded-xl border bg-muted p-4">
            <ul className="grid gap-3 sm:grid-cols-2">
              {BRANDS.map((item) => (
                <PrivacyListItem descKey={t(item.descKey)} key={item.descKey} name={item.name} />
              ))}
            </ul>
          </div>
          <p className="mt-4 text-muted-foreground text-sm italic">
            {t("section_third_party_footer")}
          </p>
        </section>

        <section>
          <h2 className={SECTION_TITLE}>{t("section_rights_title")}</h2>
          <p>{t("section_rights_desc")}</p>
        </section>

        <section>
          <h2 className={SECTION_TITLE}>{t("section_contact_title")}</h2>
          <p>{t("section_contact_desc")}</p>
          <div className="mt-4">
            <a
              className="hover:no-underline"
              href="mailto:legal@doxynix.space?subject=Privacy Policy Question"
            >
              legal@doxynix.space
            </a>
          </div>
        </section>
      </div>
    </div>
  );
}
