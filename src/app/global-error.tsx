"use client";

import React, { useState } from "react";
import * as Sentry from "@sentry/nextjs";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [requestId, setRequestId] = useState<string | null>(null);
  const currentUrl = typeof window !== "undefined" ? window.location.href : "";
  const userAgent = typeof window !== "undefined" ? window.navigator.userAgent : "";
  const screenSize =
    typeof window !== "undefined" ? `${window.innerWidth}x${window.innerHeight}` : "N/A";
  const timestamp = new Date().toISOString();
  const finalId = requestId ?? error.digest ?? "No-ID";
  const emailSubject = `[Bug Report] Doxynix - Error ${finalId}`;

  React.useEffect(() => {
    const requestId = document.cookie
      .split("; ")
      .find((row) => row.startsWith("last_request_id="))
      ?.split("=")[1];

    if (requestId != null) {
      Sentry.setTag("request_id", requestId);
      Sentry.setTag("error_type", "fatal_global");
      setRequestId(requestId);
    }

    Sentry.captureException(error);
  }, [error]);

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

  return (
    <html lang="en">
      <head>
        <style>{`
          body { margin: 0; font-family: sans-serif; background: #09090b; color: #fafafa; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
          .container { max-width: 400px; padding: 24px; text-align: center; }
          .icon-circle { width: 80px; height: 80px; background: rgba(239, 68, 68, 0.1); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 24px; }
          h1 { font-size: 30px; font-weight: 700; margin: 0 0 16px; letter-spacing: -0.025em; }
          p { color: #a1a1aa; line-height: 1.6; margin-bottom: 24px; }
          .digest-box { background: #18181b; border: 1px solid #27272a; border-radius: 12px; padding: 16px; text-align: left; margin-bottom: 32px; }
          .digest-label { font-size: 10px; font-weight: 600; text-transform: uppercase; color: #71717a; margin: 0 0 8px; }
          code { font-family: monospace; font-size: 12px; color: #a1a1aa; word-break: break-all; opacity: 0.8; }
          button { background: #fafafa; color: #09090b; border: none; border-radius: 6px; padding: 10px 24px; font-weight: 500; cursor: pointer; transition: opacity 0.2s; }
          button:hover { opacity: 0.9; }
          footer { margin-top: 48px; font-size: 14px; color: #52525b; }
        `}</style>
      </head>
      <body>
        <div className="container">
          <div className="icon-circle">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="35"
              height="35"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#ef4444"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <rect width="20" height="8" x="2" y="2" rx="2" ry="2" />
              <rect width="20" height="8" x="2" y="14" rx="2" ry="2" />
              <line x1="6" x2="6.01" y1="6" y2="6" />
              <line x1="6" x2="6.01" y1="18" y2="18" />
            </svg>
          </div>

          <h1>Critical System Failure</h1>
          <p>
            A fatal error occurred in the application core. We&apos;ve been notified and are looking
            into it.
          </p>

          <div className="digest-box">
            <p className="digest-label">Error Digest</p>
            <code> {requestId ?? error.digest ?? "System Failure"}</code>
          </div>

          <button onClick={() => reset()}>Try to restart the app</button>

          <footer className="mt-12 text-sm">
            Doxynix Infrastructure Support If the error persists, contact us:{" "}
            <a href={mailtoLink} className="underline hover:no-underline">
              support@doxynix.space
            </a>
          </footer>
        </div>
      </body>
    </html>
  );
}
