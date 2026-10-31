"use client";

import { useTranslations } from "next-intl";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/core/card";

type Props = {
  activeMembers: number;
  seatLimit: number;
};

// Seats are not bought by hand: the subscription quantity follows the membership count, and adding
// a member invoices the extra seat. A separate quantity input would fight that sync.
export function SeatsCard({ activeMembers, seatLimit }: Readonly<Props>) {
  const t = useTranslations("Billing");

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("billing_seats_title")}</CardTitle>
        <CardDescription>{t("billing_seats_desc")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground text-sm">{t("billing_seats_usage")}</span>
          <span className="font-semibold">
            {seatLimit > 0
              ? t("billing_seats_used", { limit: seatLimit, used: activeMembers })
              : t("billing_seats_active", { count: activeMembers })}
          </span>
        </div>
        <p className="text-muted-foreground text-sm">{t("billing_seats_follow_members")}</p>
      </CardContent>
    </Card>
  );
}
