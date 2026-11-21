"use client";

import { useTranslations } from "next-intl";

import { Link } from "@/shared/i18n/navigation";
import { AppButton } from "@/shared/ui/core/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/shared/ui/core/card";
import { Progress } from "@/shared/ui/core/progress";

type Props = {
  activeMembers: number;
  seatLimit: number;
};

// Seats are not bought by hand: the subscription quantity follows the membership count, and adding
// a member invoices the extra seat. A separate quantity input would fight that sync.
export function SeatsCard({ activeMembers, seatLimit }: Readonly<Props>) {
  const t = useTranslations("Billing");
  const tCommon = useTranslations("Common");

  const used = Math.max(0, activeMembers);
  const limit = Math.max(0, seatLimit);
  const hasLimit = limit > 0;
  const percent = hasLimit ? Math.min(100, (used / limit) * 100) : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("billing_seats_title")}</CardTitle>
        <CardDescription>{t("billing_seats_desc")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-baseline gap-1.5 tabular-nums">
          <span className="font-semibold text-3xl">{used}</span>
          {hasLimit && <span className="text-lg text-muted-foreground">/ {limit}</span>}
        </div>
        {hasLimit && (
          <Progress
            aria-label={t("billing_seats_usage")}
            value={percent}
          />
        )}
        <p className="text-muted-foreground text-xs">
          {hasLimit
            ? t("billing_seats_used", { limit, used })
            : t("billing_seats_active", { count: used })}
        </p>
      </CardContent>
      <CardFooter className="mt-auto justify-end border-t">
        <AppButton
          asChild
          size="sm"
          variant="outline"
        >
          <Link href="/dashboard/settings/members">{tCommon("nav_members")}</Link>
        </AppButton>
      </CardFooter>
    </Card>
  );
}
