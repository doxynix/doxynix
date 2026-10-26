import { getTranslations } from "next-intl/server";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/core/card";
import { Skeleton } from "@/shared/ui/core/skeleton";
import { SkeletonText } from "@/shared/ui/kit/app-skeleton";

export async function ProfileSkeleton() {
  const t = await getTranslations("Dashboard");
  return (
    <div className="flex w-full flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("settings_profile_picture_title")}</CardTitle>
          <CardDescription>{t("settings_profile_picture_desc")}</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-6">
          <Skeleton className="size-24 rounded-full" />
          <div className="flex flex-col gap-2">
            <SkeletonText
              lines={1}
              widths={["w-48"]}
            />
            <SkeletonText
              lines={1}
              size="sm"
              widths={["w-40"]}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("settings_profile_personal_information_title")}</CardTitle>
          <CardDescription>{t("settings_profile_personal_information_desc")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <SkeletonText
              lines={1}
              size="sm"
              widths={["w-40"]}
            />
            <Skeleton className="h-9 w-full rounded-xl" />
          </div>
          <div className="flex flex-col gap-2">
            <SkeletonText
              lines={1}
              size="sm"
              widths={["w-40"]}
            />
            <Skeleton className="h-9 w-full rounded-xl" />
          </div>
          <div className="flex justify-end">
            <Skeleton className="h-9 w-36 rounded-xl" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
