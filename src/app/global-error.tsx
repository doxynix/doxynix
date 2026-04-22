"use client";

import { useEffect, useState } from "react";

export default function GlobalError({
  error,
  reset,
}: Readonly<{
  error: Error & { digest?: string };
  reset: () => void;
}>) {
  const [requestId, setRequestId] = useState<null | string>(null);
  const isClient = typeof window !== "undefined";
  const currentUrl = isClient ? globalThis.location.href : "";
  const userAgent = isClient ? globalThis.navigator.userAgent : "";
  const screenSize = isClient
    ? `${globalThis.window.innerWidth}x${globalThis.window.innerHeight}`
    : "N/A";

  const timestamp = new Date().toISOString();
  const finalId = requestId ?? error.digest ?? "No-ID";
  const emailSubject = `[Bug Report] Doxynix - Error ${finalId}`;

  useEffect(() => {
    const requestId = document.cookie
      .split("; ")
      .find((row) => row.startsWith("last_request_id="))
      ?.split("=")[1];

    if (requestId != null) {
      setRequestId(requestId);
    }

    let isActive = true;

    void import("@sentry/nextjs")
      .then((Sentry) => {
        if (!isActive) return;

        if (requestId != null) {
          Sentry.setTag("request_id", requestId);
          Sentry.setTag("error_type", "fatal_global");
        }

        Sentry.captureException(error);
      })
      .catch((error) => {
        console.error("Sentry is unavailable", error);
      });

    return () => {
      isActive = false;
    };
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
  const themeBootstrapScript = `
    try {
      const cookieTheme = document.cookie
        .split("; ")
        .find((row) => row.startsWith("doxynix-theme="))
        ?.split("=")[1];
      const storedTheme = localStorage.getItem("doxynix-theme");
      const rawTheme = cookieTheme ?? storedTheme;
      const theme =
        rawTheme === "light" || rawTheme === "dark" || rawTheme === "system"
          ? rawTheme
          : "system";
      const isDark =
        theme === "dark" ||
        (theme !== "light" && window.matchMedia("(prefers-color-scheme: dark)").matches);

      document.documentElement.classList.toggle("dark", isDark);
    } catch {}
  `;

  return (
    <html suppressHydrationWarning lang="en">
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrapScript }} />
        <style>{`
          :root {
            --surface-page: oklch(0.985 0.002 255);
            --surface-panel: oklch(1 0 0);
            --text-primary: oklch(0.145 0.004 255);
            --text-muted: oklch(0.57 0.004 255);
            --text-soft: oklch(0.43 0.006 255);
            --primary: oklch(0.145 0.004 255);
            --primary-foreground: oklch(0.985 0.002 255);
            --status-error: oklch(0.6 0.18 25);
            --status-error-bg: oklch(0.6 0.18 25 / 0.12);
            --border-soft: oklch(0.922 0.004 255);
            --border-strong: oklch(0.86 0.005 255);
          }
          html.dark {
            --surface-page: oklch(0.145 0.004 255);
            --surface-panel: oklch(0.205 0.004 255);
            --text-primary: oklch(0.985 0.002 255);
            --text-muted: oklch(0.58 0.004 255);
            --text-soft: oklch(0.74 0.004 255);
            --primary: oklch(0.985 0.002 255);
            --primary-foreground: oklch(0.145 0.004 255);
            --status-error: oklch(0.7 0.16 25);
            --status-error-bg: oklch(0.7 0.16 25 / 0.12);
            --border-soft: oklch(0.285 0.004 255);
            --border-strong: oklch(0.36 0.004 255);
          }
          body { margin: 0; font-family: sans-serif; background: var(--surface-page); color: var(--text-primary); display: flex; align-items: center; justify-content: center; min-height: 100dvh; }
          .container { max-width: 400px; padding: 24px; text-align: center; }
          .icon-circle { width: 80px; height: 80px; background: var(--status-error-bg); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 24px; }
          h1 { font-size: 30px; font-weight: 700; margin: 0 0 16px; letter-spacing: -0.025em; }
          p { color: var(--text-muted); line-height: 1.6; margin-bottom: 24px; }
          .digest-box { background: var(--surface-panel); border: 1px solid var(--border-soft); border-radius: 12px; padding: 16px; text-align: left; margin-bottom: 32px; }
          .digest-label { font-size: 10px; font-weight: 600; text-transform: uppercase; color: var(--text-soft); margin: 0 0 8px; }
          code { font-family: monospace; font-size: 12px; color: var(--text-muted); word-break: break-all; opacity: 0.8; }
          button { background: var(--primary); color: var(--primary-foreground); border: 1px solid var(--border-strong); border-radius: 10px; padding: 10px 24px; font-weight: 500; cursor: pointer; transition: box-shadow 0.2s, border-color 0.2s; }
          button:hover { border-color: var(--border-strong); box-shadow: 0 4px 18px color-mix(in oklab, var(--text-primary) 14%, transparent); }
          footer { margin-top: 48px; font-size: 14px; color: var(--text-soft); }
          .error-icon { stroke: var(--status-error); }
        `}</style>
      </head>
      <body>
        <div className="container">
          <div className="icon-circle">
            <svg
              fill="none"
              height="35"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              width="35"
              xmlns="http://www.w3.org/2000/svg"
              className="error-icon"
            >
              <rect height="8" rx="2" ry="2" width="20" x="2" y="2" />
              <rect height="8" rx="2" ry="2" width="20" x="2" y="14" />
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
