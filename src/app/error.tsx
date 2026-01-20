"use client";

import React, { useState } from "react";
import Cookies from "js-cookie";
import { ServerCrash } from "lucide-react";

import BackOrLinkButton from "@/shared/ui/BackOrLinkButton";
import { Button } from "@/shared/ui/button";
import { CopyButton } from "@/shared/ui/CopyButton";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [requestId, setRequestId] = useState<string>("");
  const currentUrl = typeof window !== "undefined" ? window.location.href : "";
  const userAgent = typeof window !== "undefined" ? window.navigator.userAgent : "";
  const screenSize =
    typeof window !== "undefined" ? `${window.innerWidth}x${window.innerHeight}` : "N/A";
  const timestamp = new Date().toISOString();
  const finalId = requestId ?? error.digest ?? "No-ID";

  const emailSubject = `[Bug Report] Doxynix - Error ${finalId}`;

  const emailBody = `
    Describe what you were doing before the error (optional):
    >>> WRITE HERE <<<

    ------------------------------------------------
    Technical Information (Please, do not edit):
    ------------------------------------------------
    Error ID: ${finalId}
    Page: ${currentUrl}
    Screen: ${screenSize}
    Time: ${timestamp}
    User Agent: ${userAgent}
  `.trim();

  const mailtoLink = `mailto:support@doxynix.space?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;

  React.useEffect(() => {
    const rid = Cookies.get("last_request_id");
    if (rid !== null && rid !== undefined) {
      setRequestId(rid);
    }
  }, [error]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4">
      <div className="bg-destructive/10 text-destructive flex size-20 items-center justify-center rounded-full">
        <ServerCrash className="animate-pulse" size={35} />
      </div>

      <div className="w-full max-w-md space-y-4 text-center">
        <h1 className="text-3xl font-bold tracking-tight">500 — Server Error</h1>
        <p className="text-muted-foreground text-base">
          Something unexpected happened. We&apos;ve been notified and are looking into it.
        </p>
        <p className="text-muted-foreground text-left text-xs font-semibold tracking-wider uppercase">
          Request ID
        </p>
        <div className="bg-muted/50 border-border space-y-3 rounded-xl border p-2 text-left">
          <div className="group flex items-center justify-between">
            <code className="text-xs break-all">
              {requestId ?? error.digest ?? "System Failure"}
            </code>
            <CopyButton
              tooltipText="Copy Request ID"
              className="opacity-100"
              value={requestId ?? error.digest ?? ""}
            />
          </div>

          {process.env.NODE_ENV === "development" && (
            <div className="border-border/50 border-t pt-2">
              <p className="text-destructive/70 text-xs font-semibold uppercase">Debug Error:</p>
              <p className="text-destructive truncate font-mono text-xs">{error.message}</p>
            </div>
          )}
        </div>

        <div className="flex flex-col items-center justify-center gap-3 pt-4 sm:flex-row">
          <Button onClick={reset} className="cursor-pointer">
            Try again
          </Button>
          <BackOrLinkButton text="Go back" />
        </div>
      </div>

      <footer className="mt-12 text-sm">
        If the error persists, contact us:{" "}
        <a href={mailtoLink} className="underline hover:no-underline">
          support@doxynix.space
        </a>
      </footer>
    </div>
  );
}
