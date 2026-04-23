"use client";

import { useEffect, useState } from "react";
import * as Sentry from "@sentry/nextjs";
import Cookies from "js-cookie";
import { ServerCrash } from "lucide-react";
import { useTranslations } from "next-intl";

import { IS_DEV } from "@/shared/constants/env.flags";
import { Button } from "@/shared/ui/core/button";
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
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const rid = Cookies.get("last_request_id") ?? null;
    if (rid != null) {
      requestAnimationFrame(() => setRequestId(rid));
    }
    setReady(true);
  }, []);

  const [techInfo, setTechInfo] = useState(() => ({
    screen: "N/A",
    time: new Date().toISOString(),
    ua: "",
    url: "",
  }));

  useEffect(() => {
    setTechInfo({
      screen: `${window.innerWidth}x${window.innerHeight}`,
      time: new Date().toISOString(),
      ua: window.navigator.userAgent,
      url: window.location.href,
    });
  }, []);

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

  useEffect(() => {
    if (!ready) return;

    Sentry.withScope((scope) => {
      if (requestId) {
        scope.setTag("request_id", requestId);
      }
      scope.setExtra("digest", error.digest);
      Sentry.captureException(error);
    });
  }, [error, ready, requestId]);

  return (
    <div className="mx-auto flex max-w-3xl flex-1 flex-col items-center justify-center px-4">
      <div className="bg-destructive/10 text-destructive flex size-20 items-center justify-center rounded-full">
        <ServerCrash size={35} />
      </div>

      <div className="w-full max-w-md space-y-4 text-center">
        <h1 className="text-3xl font-bold tracking-tight">{t("server_error_title")}</h1>
        <p className="text-muted-foreground text-base">{t("server_error_desc")}</p>
        <p className="text-muted-foreground text-left text-xs font-semibold tracking-wider uppercase">
          {t("request_id_label")}
        </p>
        <div className="bg-muted/50 border-border space-y-3 rounded-xl border p-2 text-left">
          <div className="group flex items-center justify-between">
            <code className="text-xs break-all">
              {requestId ?? error.digest ?? "System Failure"}
            </code>
            <CopyButton
              value={requestId ?? error.digest ?? ""}
              tooltipText={tCommon("copy")}
              className="opacity-100"
            />
          </div>

          {IS_DEV && (
            <div className="border-border/50 border-t pt-2">
              <p className="text-destructive/70 text-xs font-semibold uppercase">Debug Error:</p>
              <p className="text-destructive truncate text-xs">{error.message}</p>
            </div>
          )}
        </div>

        <div className="flex flex-col items-center justify-center gap-3 pt-4 sm:flex-row">
          <BackOrLinkButton label={tCommon("back")} className="cursor-pointer" />
          <Button onClick={reset} className="cursor-pointer">
            {t("try_recover_btn")}
          </Button>
        </div>
      </div>

      <footer className="mt-12 flex flex-col gap-4 text-sm">
        <div>
          <span>{t("footer")} </span>
          <a href={mailtoLink} className="underline hover:no-underline">
            support@doxynix.space
          </a>
        </div>
        <Button asChild size="sm" variant="outline" className="mx-auto w-fit">
          <ExternalLink href="https://status.doxynix.space" className="flex items-center gap-2.5">
            Check System Status
          </ExternalLink>
        </Button>
      </footer>
    </div>
  );
}