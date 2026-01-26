import { getTranslations } from "next-intl/server";

import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/core/card";
import { Skeleton } from "@/shared/ui/core/skeleton";

export async function ProfileSkeleton() {
  const t = await getTranslations("Dashboard");
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>{t("settings_profile_picture_title")}</CardTitle>
          <div className="text-muted-foreground text-sm">{t("settings_profile_picture_desc")}</div>
        </CardHeader>
        <CardContent className="flex items-center gap-6">
          <Skeleton className="h-24 w-24 rounded-full" />
          <div className="flex flex-col gap-2">
            <Skeleton className="h-8.5 w-40" />
            <Skeleton className="h-4 w-40" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("settings_profile_personal_information_title")}</CardTitle>
          {/* <div className="text-muted-foreground text-sm">Update your name or email.</div> */}
          <div className="text-muted-foreground text-sm">
            {t("settings_profile_personal_information_desc")}
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-0.5">
            <div className="text-muted-foreground text-sm">
              {t("settings_profile_personal_information_label")}
            </div>
            <Skeleton className="h-9 w-full" />
          </div>
          {/* <div className="flex flex-col gap-0.5">
            <div className="text-muted-foreground text-sm">Email</div>
            <Skeleton className="h-9 w-full" />
          </div> */}
          <div className="flex justify-end">
            <Skeleton className="h-9 w-36" />
          </div>
        </CardContent>
      </Card>
    </>
  );
}
