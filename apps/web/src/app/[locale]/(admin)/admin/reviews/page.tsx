import { getTranslations } from "next-intl/server";

import { createMetadata } from "@/shared/lib/metadata";

import { AdminReviewContainer } from "@/features/admin/ui/admin-review-container";

export const generateMetadata = createMetadata("admin_reviews_title", "admin_reviews_desc");

export default async function AdminReviewsPage() {
  const t = await getTranslations("AdminReview");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="font-bold text-2xl tracking-tight">{t("page_title")}</h1>
        <p className="text-muted-foreground text-sm">{t("page_desc")}</p>
      </div>

      <AdminReviewContainer />
    </div>
  );
}
