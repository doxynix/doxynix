"use client";

import type { AccessState } from "@doxynix/shared";
import { useLocale, useTranslations } from "next-intl";

import { formatShortDate } from "@/shared/lib/date-utils";
import { Alert, AlertDescription } from "@/shared/ui/core/alert";

type Props = {
  accessState: AccessState;
  graceEndsAt: Date | null;
};

function bannerKey(accessState: AccessState): null | string {
  switch (accessState) {
    case "ACTIVE": {
      return null;
    }
    case "CANCELED": {
      return "billing_banner_canceled";
    }
    case "GRACE": {
      return "billing_banner_grace";
    }
    case "NO_SUBSCRIPTION": {
      return "billing_banner_no_subscription";
    }
    case "PENDING": {
      return "billing_banner_pending";
    }
    case "REVIEW": {
      return "billing_banner_review";
    }
    case "SUSPENDED": {
      return "billing_banner_suspended";
    }
  }
}

export function AccessStateBanner({ accessState, graceEndsAt }: Readonly<Props>) {
  const t = useTranslations("Billing");
  const locale = useLocale();
  const key = bannerKey(accessState);

  if (key == null) {
    return null;
  }

  const isBlocking =
    accessState === "CANCELED" || accessState === "REVIEW" || accessState === "SUSPENDED";

  return (
    <Alert variant={isBlocking ? "destructive" : "default"}>
      <AlertDescription>
        {key === "billing_banner_grace" && graceEndsAt != null
          ? t(key, { date: formatShortDate(graceEndsAt, locale) })
          : t(key)}
      </AlertDescription>
    </Alert>
  );
}
