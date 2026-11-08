"use client";

import { useEffect, useState } from "react";

// The dynamic import lives here rather than in the component: React Compiler cannot lower a
// dynamic import and bails out of the whole function that contains one.
async function loadSentry() {
  return import("@sentry/nextjs");
}

export default function GlobalError({
  error,
  reset,
}: Readonly<{
  error: Error & { digest?: string };
  reset: () => void;
}>) {
  const [requestId, setRequestId] = useState<null | string>(null);

  const finalId = requestId ?? error.digest ?? "No-ID";
  const emailSubject = `[Bug Report] Doxynix - Error ${finalId}`;

  useEffect(() => {
    let isActive = true;

    const rid =
      document.cookie
        .split("; ")
        .find((row) => row.startsWith("last_request_id="))
        ?.split("=")[1] ?? null;

    if (rid != null) {
      requestAnimationFrame(() => {
        if (isActive) {
          setRequestId(rid);
        }
      });
    }

    void loadSentry().then((Sentry) => {
      if (!isActive) {
        return;
      }

      if (rid !== null) {
        Sentry.setTag("request_id", rid);
        Sentry.setTag("error_type", "fatal_global");
      }

      Sentry.captureException(error);
    });

    return () => {
      isActive = false;
    };
  }, [error]);

  const [techInfo] = useState(() => {
    const isClient = typeof window !== "undefined";
    return {
      screen: isClient ? `${globalThis.window.innerWidth}x${globalThis.window.innerHeight}` : "N/A",
      time: new Date().toISOString(),
      ua: isClient ? globalThis.navigator.userAgent : "",
      url: isClient ? globalThis.location.href : "",
    };
  });

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
  const themeBootstrapScript = `
    (function () {
      var root = document.documentElement;
      var appearance = {};
      try {
        var stored = localStorage.getItem("doxynix-appearance");
        var parsed = stored ? JSON.parse(stored) : null;
        if (parsed && typeof parsed === "object") appearance = parsed;
      } catch (e) {}
      function pick(value, allowed, fallback) {
        return allowed.indexOf(value) === -1 ? fallback : value;
      }
      root.setAttribute("data-radius", pick(appearance.radius, ["sharp", "default", "soft"], "default"));
      root.setAttribute("data-text-scale", pick(appearance.textScale, ["compact", "default", "large"], "default"));
      root.setAttribute("data-theme", pick(appearance.theme, ["neutral", "violet", "ocean", "forest", "sunset", "mocha"], "neutral"));
      root.setAttribute("data-border-contrast", pick(appearance.borderContrast, ["soft", "strong"], "soft"));
      root.toggleAttribute("data-reduce-motion", appearance.reduceMotion === true);
      root.toggleAttribute("data-pointer-cursor", appearance.pointerCursor !== false);
      root.toggleAttribute("data-underline-links", appearance.underlineLinks === true);

      var cookieTheme;
      try {
        cookieTheme = document.cookie
          .split("; ")
          .find(function (row) { return row.indexOf("doxynix-theme=") === 0; });
        cookieTheme = cookieTheme ? cookieTheme.split("=")[1] : undefined;
      } catch (e) {}
      var storedTheme;
      try { storedTheme = localStorage.getItem("doxynix-theme"); } catch (e) {}

      var mode = pick(cookieTheme || storedTheme || appearance.mode, ["light", "dark", "system"], "system");
      var isDark =
        mode === "dark" ||
        (mode !== "light" && window.matchMedia("(prefers-color-scheme: dark)").matches);

      root.classList.toggle("dark", isDark);
      root.style.colorScheme = isDark ? "dark" : "light";
    })();
  `;

  return (
    <html
      lang="en"
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrapScript }} />
        <style>{`
          :root {
            --radius: 12px;
            --radius-sm: 10px;
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
          :root[data-radius="sharp"] { --radius: 6px; --radius-sm: 6px; }
          :root[data-radius="soft"] { --radius: 18px; --radius-sm: 14px; }
          :root[data-text-scale="compact"] { font-size: 14px; }
          :root[data-text-scale="large"] { font-size: 17px; }
          :root[data-theme="violet"] { --primary: oklch(0.5 0.2 310); --primary-foreground: oklch(0.985 0.002 255); }
          :root.dark[data-theme="violet"] { --primary: oklch(0.78 0.12 310); --primary-foreground: oklch(0.145 0.004 255); }
          :root[data-theme="ocean"] { --primary: oklch(0.5 0.16 230); --primary-foreground: oklch(0.985 0.002 255); }
          :root.dark[data-theme="ocean"] { --primary: oklch(0.78 0.1 230); --primary-foreground: oklch(0.145 0.004 255); }
          :root[data-theme="forest"] { --primary: oklch(0.48 0.14 150); --primary-foreground: oklch(0.985 0.002 255); }
          :root.dark[data-theme="forest"] { --primary: oklch(0.78 0.11 150); --primary-foreground: oklch(0.145 0.004 255); }
          :root[data-theme="sunset"] { --primary: oklch(0.56 0.17 50); --primary-foreground: oklch(0.985 0.002 255); }
          :root.dark[data-theme="sunset"] { --primary: oklch(0.8 0.12 50); --primary-foreground: oklch(0.145 0.004 255); }
          :root[data-theme="mocha"] { --primary: oklch(0.52 0.12 30); --primary-foreground: oklch(0.985 0.002 255); }
          :root.dark[data-theme="mocha"] { --primary: oklch(0.79 0.09 30); --primary-foreground: oklch(0.145 0.004 255); }
          :root[data-reduce-motion] button { transition: none; }
          body { margin: 0; font-family: sans-serif; font-size: 1rem; background: var(--surface-page); color: var(--text-primary); display: flex; align-items: center; justify-content: center; min-height: 100dvh; }
          .container { max-width: 400px; padding: 24px; text-align: center; }
          .icon-circle { width: 80px; height: 80px; background: var(--status-error-bg); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 24px; }
          h1 { font-size: 1.875rem; font-weight: 700; margin: 0 0 16px; letter-spacing: -0.025em; }
          p { color: var(--text-muted); line-height: 1.6; margin-bottom: 24px; }
          .digest-box { background: var(--surface-panel); border: 1px solid var(--border-soft); border-radius: var(--radius); padding: 16px; text-align: left; margin-bottom: 32px; }
          .digest-label { font-size: 0.625rem; font-weight: 600; text-transform: uppercase; color: var(--text-soft); margin: 0 0 8px; }
          code { font-family: monospace; font-size: 0.75rem; color: var(--text-muted); word-break: break-all; opacity: 0.8; }
          button { background: var(--primary); color: var(--primary-foreground); border: 1px solid var(--border-strong); border-radius: var(--radius-sm); padding: 10px 24px; font-weight: 500; cursor: pointer; transition: box-shadow 0.2s, border-color 0.2s; }
          button:hover { border-color: var(--border-strong); box-shadow: 0 4px 18px color-mix(in oklab, var(--text-primary) 14%, transparent); }
          footer { margin-top: 48px; font-size: 0.875rem; color: var(--text-soft); }
          .error-icon { stroke: var(--status-error); }
        `}</style>
      </head>
      <body>
        <div className="container">
          <div className="icon-circle">
            <svg
              className="error-icon"
              fill="none"
              height="35"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              width="35"
              xmlns="http://www.w3.org/2000/svg"
            >
              <rect
                height="8"
                rx="2"
                ry="2"
                width="20"
                x="2"
                y="2"
              />
              <rect
                height="8"
                rx="2"
                ry="2"
                width="20"
                x="2"
                y="14"
              />
              <line
                x1="6"
                x2="6.01"
                y1="6"
                y2="6"
              />
              <line
                x1="6"
                x2="6.01"
                y1="18"
                y2="18"
              />
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

          <button
            onClick={() => reset()}
            type="button"
          >
            Try to restart the app
          </button>

          <footer className="mt-12 text-sm">
            Doxynix Infrastructure Support If the error persists, contact us:{" "}
            <a
              className="underline hover:no-underline"
              href={mailtoLink}
            >
              support@doxynix.space
            </a>
          </footer>
        </div>
      </body>
    </html>
  );
}
