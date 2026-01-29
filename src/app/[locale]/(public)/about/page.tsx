import { getTranslations } from "next-intl/server";

import { createMetadata } from "@/shared/lib/metadata";

// export const runtime = "edge";

export const generateMetadata = createMetadata("about_title", "about_desc");

export default async function AboutPage() {
  const t = await getTranslations("About");
  return (
    <div className="flex items-center justify-center pt-16">
      <div>{t("page_placeholder")}</div>
    </div>
  );
}
