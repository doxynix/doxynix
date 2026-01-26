import { getTranslations } from "next-intl/server";

import { Spinner } from "@/shared/ui/core/spinner";

export async function PageLoader() {
  const t = await getTranslations("Common");
  return (
    <div className="flex h-full min-h-full w-full min-w-full flex-1 flex-col items-center justify-center gap-4">
      <Spinner className="h-12 w-12" />
      <span className="text-muted-foreground animate-pulse text-sm font-medium">
        {t("loading")}
      </span>
    </div>
  );
}
