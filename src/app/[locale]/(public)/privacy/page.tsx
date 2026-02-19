import { getTranslations } from "next-intl/server";

import { createMetadata } from "@/shared/lib/metadata";
import { BackOrLinkButton } from "@/shared/ui/kit/back-or-link-button";

// export const runtime = "edge";

export const generateMetadata = createMetadata("privacy_title", "privacy_desc");

type Props = { name: string; descKey: string };

const SECTION_TITLE = "mb-3 text-lg font-bold text-foreground flex items-center gap-2";
const LIST_STYLES = "list-disc space-y-2 pl-5 marker:text-foreground";
const STRONG_TEXT = "font-medium text-foreground";
const LI_STYLES = "flex flex-col";
const SPAN_STYLES = "text-sm";

const BRANDS: Props[] = [
  { name: "Vercel", descKey: "brands_vercel_desc" },
  { name: "Neon (PostgreSQL)", descKey: "brands_neon_desc" },
  { name: "Resend", descKey: "brands_resend_desc" },
  { name: "OAuth Providers", descKey: "brands_oauth_desc" },
  { name: "Upstash / Redis", descKey: "brands_upstash_desc" },
  { name: "Axiom", descKey: "brands_axiom_desc" },
  { name: "UploadThing", descKey: "brands_uploadthing_desc" },
  { name: "Ably", descKey: "brands_ably_desc" },
] as const;

function PrivacyListItem({ name, descKey }: Props) {
  return (
    <li className={LI_STYLES}>
      <span className={STRONG_TEXT}>{name}</span>
      <span className={SPAN_STYLES}>{descKey}</span>
    </li>
  );
}

const richStyles = {
  strong: (chunks: React.ReactNode) => <span className={STRONG_TEXT}>{chunks}</span>,
  u: (chunks: React.ReactNode) => <u>{chunks}</u>,
  important: (chunks: React.ReactNode) => (
    <span className="text-destructive font-medium">{chunks}</span>
  ),
};

export default async function PrivacyPage() {
  const tCommon = await getTranslations("Common");
  const t = await getTranslations("Privacy");

  const tsRich = (key: string) => t.rich(key, richStyles);

  return (
    <div className="animate-fade-in container mx-auto max-w-3xl px-4 py-12 pt-24">
      <BackOrLinkButton
        className="cursor-pointer"
        showIcon
        variant="link"
        label={tCommon("back")}
      />

      <div className="mb-10 border-b py-6">
        <h1 className="mb-3 text-3xl font-bold tracking-tight md:text-4xl">{t("title")}</h1>
        <div className="text-muted-foreground flex items-center gap-2 text-sm">
          <span>{t("effective_date")}</span>
        </div>
      </div>

      <div className="prose prose-neutral dark:prose-invert max-w-none space-y-8 text-sm md:text-base">
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
          <div className="bg-muted/50 rounded-xl border p-4">
            <ul className="grid gap-3 sm:grid-cols-2">
              {BRANDS.map((item) => (
                <PrivacyListItem key={item.descKey} name={item.name} descKey={t(item.descKey)} />
              ))}
            </ul>
          </div>
          <p className="text-muted-foreground mt-4 text-sm italic">
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
              href="mailto:legal@doxynix.space?subject=Privacy Policy Question"
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
