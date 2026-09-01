"use client";

import { useEffect, useState } from "react";
import * as Sentry from "@sentry/nextjs";
import { ServerCrash } from "lucide-react";
import { useTranslations } from "next-intl";

import { IS_DEV } from "@/shared/constants/env.flags";
import { getClientCookie } from "@/shared/lib/cookies";
import { AppButton } from "@/shared/ui/core/button";
import { BackOrLinkButton } from "@/shared/ui/kit/back-or-link-button";
import { CopyButton } from "@/shared/ui/kit/copy-button";
import { ExternalLink } from "@/shared/ui/kit/external-link";

export default function ErrorPage({
  error,
  reset,
}: Readonly<{
  error: Error & { digest?: string };
  reset: () => void;
}>) {
  const tCommon = useTranslations("Common");
  const t = useTranslations("Error");

  const [requestId, setRequestId] = useState<null | string>(null);

  const [techInfo, setTechInfo] = useState(() => ({
    screen: "N/A",
    time: new Date().toISOString(),
    ua: "",
    url: "",
  }));

  useEffect(() => {
    const rid = getClientCookie("last_request_id");

    const info = {
      screen: `${window.innerWidth}x${window.innerHeight}`,
      time: new Date().toISOString(),
      ua: window.navigator.userAgent,
      url: window.location.href,
    };

    requestAnimationFrame(() => {
      setRequestId(rid);
      setTechInfo(info);
    });

    Sentry.withScope((scope) => {
      if (rid != null) {
        scope.setTag("request_id", rid);
      }
      scope.setExtra("digest", error.digest);
      Sentry.captureException(error);
    });
  }, [error]);

  const finalId = requestId ?? error.digest ?? "No-ID";

  const emailSubject = `[Bug Report] Doxynix - Error ${finalId}`;

  const emailBody = `
    Describe what you were doing before the error (optional):
    >>> WRITE HERE <<<

    ------------------------------------------------
    Technical Information (Please, do not edit):
    ------------------------------------------------
    Error ID: ${finalId}
    Page: ${techInfo.url}
    Screen: ${techInfo.screen}
    Time: ${techInfo.time}
    User Agent: ${techInfo.ua}
  `.trim();

  const mailtoLink = `mailto:support@doxynix.space?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;

  return (
    <div className="mx-auto flex max-w-3xl flex-1 flex-col items-center justify-center px-4">
      <div className="flex size-20 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <ServerCrash size={35} />
      </div>

      <div className="flex w-full max-w-md flex-col gap-4 text-center">
        <h1 className="font-bold text-3xl tracking-tight">{t("server_error_title")}</h1>
        <p className="text-base text-muted-foreground">{t("server_error_desc")}</p>
        <p className="text-left font-semibold text-muted-foreground text-xs uppercase tracking-wider">
          {t("request_id_label")}
        </p>
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-muted p-2 text-left">
          <div className="group flex items-center justify-between">
            <code className="break-all text-xs">
              {requestId ?? error.digest ?? "System Failure"}
            </code>
            <CopyButton
              className="opacity-100"
              tooltipText={tCommon("copy")}
              value={requestId ?? error.digest ?? ""}
            />
          </div>

          {IS_DEV && (
            <div className="border-border border-t pt-2">
              <p className="font-semibold text-destructive text-xs uppercase">Debug Error:</p>
              <p className="truncate text-destructive text-xs">{error.message}</p>
            </div>
          )}
        </div>

        <div className="flex flex-col items-center justify-center gap-3 pt-4 sm:flex-row">
          <BackOrLinkButton className="cursor-pointer" label={tCommon("back")} />
          <AppButton className="cursor-pointer" onClick={reset}>
            {t("try_recover_btn")}
          </AppButton>
        </div>
      </div>

      <footer className="mt-12 flex flex-col gap-4 text-sm">
        <div>
          <span>{t("footer")} </span>
          <a className="underline hover:no-underline" href={mailtoLink}>
            support@doxynix.space
          </a>
        </div>
        <AppButton asChild className="mx-auto w-fit" size="sm" variant="outline">
          <ExternalLink className="flex items-center gap-2.5" href="https://status.doxynix.space">
            Check System Status
          </ExternalLink>
        </AppButton>
      </footer>
    </div>
  );
}
