import { getTranslations } from "next-intl/server";

import { createMetadata } from "@/shared/lib/metadata";

// export const runtime = "edge";

export const generateMetadata = createMetadata("support_title", "support_desc");

export default async function SupportPage() {
  const t = await getTranslations("Support");
  return (
    <div className="flex items-center justify-center pt-16">
      <div>{t("page_placeholder")}</div>
    </div>
  );
}
