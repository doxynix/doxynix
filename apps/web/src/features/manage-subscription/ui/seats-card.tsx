"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/core/card";
import { Input } from "@/shared/ui/core/input";
import { Label } from "@/shared/ui/core/label";
import { LoadingButton } from "@/shared/ui/kit/loading-button";

import { billingErrorKey } from "../model/billing-errors";
import { formatCurrency } from "../model/format";
import type { BillingSubscription } from "../model/types";
import { useSubscriptionActions } from "../model/use-subscription-actions";

type Props = {
  activeMembers: number;
  isOwner: boolean;
  planCode: string;
  seatLimit: number;
  subscription: BillingSubscription | null;
};

export function SeatsCard({
  activeMembers,
  isOwner,
  planCode,
  seatLimit,
  subscription,
}: Readonly<Props>) {
  const t = useTranslations("Billing");
  const locale = useLocale();
  const { changeSeats, preview } = useSubscriptionActions();
  const [draft, setDraft] = useState<null | number>(null);
  const [errorKey, setErrorKey] = useState<null | string>(null);

  const quantity = draft ?? activeMembers;
  const minSeats = Math.max(1, activeMembers);
  const editable = isOwner && planCode === "PRO" && subscription != null;
  const validQuantity = Number.isInteger(quantity) && quantity >= minSeats && quantity <= 1000;
  const previewMatches = validQuantity && preview.data?.quantity === quantity;

  const changeQuantity = (next: number) => {
    setDraft(next);
    setErrorKey(null);
    preview.reset();
  };

  const runPreview = () => {
    setErrorKey(null);
    preview.mutate(
      { quantity },
      {
        onError: (error) => setErrorKey(billingErrorKey(error)),
        onSuccess: () => setErrorKey(null),
      },
    );
  };

  const confirm = () => {
    setErrorKey(null);
    changeSeats.mutate(
      { quantity, requestId: crypto.randomUUID() },
      {
        onError: (error) => setErrorKey(billingErrorKey(error)),
        onSuccess: () => {
          toast.success(t("billing_seats_changed"));
          setDraft(null);
          preview.reset();
        },
      },
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("billing_seats_title")}</CardTitle>
        <CardDescription>{t("billing_seats_desc")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground text-sm">{t("billing_seats_usage")}</span>
          <span className="font-semibold">
            {seatLimit > 0
              ? t("billing_seats_used", { limit: seatLimit, used: activeMembers })
              : t("billing_seats_active", { count: activeMembers })}
          </span>
        </div>

        {editable ? (
          <>
            <div className="flex flex-col gap-2">
              <Label htmlFor="billing-seats">{t("billing_seats_input_label")}</Label>
              <Input
                id="billing-seats"
                max={1000}
                min={minSeats}
                onChange={(event) => changeQuantity(Number(event.target.value))}
                type="number"
                value={quantity}
              />
              <p className="text-muted-foreground text-xs">
                {t("billing_seats_min", { count: activeMembers })}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <LoadingButton
                disabled={!validQuantity}
                isLoading={preview.isPending}
                onClick={runPreview}
                variant="outline"
              >
                {t("billing_seats_preview")}
              </LoadingButton>
              <LoadingButton
                disabled={!previewMatches}
                isLoading={changeSeats.isPending}
                onClick={confirm}
              >
                {t("billing_seats_confirm")}
              </LoadingButton>
            </div>

            {preview.data != null && (
              <p className="text-sm">
                {preview.data.amountDueCents > 0
                  ? t("billing_seats_amount_due", {
                      amount: formatCurrency(
                        preview.data.amountDueCents,
                        preview.data.currency,
                        locale,
                      ),
                    })
                  : t("billing_seats_no_charge")}
              </p>
            )}
          </>
        ) : (
          <p className="text-muted-foreground text-sm">
            {isOwner ? t("billing_seats_requires_subscription") : t("billing_read_only")}
          </p>
        )}

        {errorKey != null && <p className="text-destructive text-sm">{t(errorKey)}</p>}
      </CardContent>
    </Card>
  );
}
