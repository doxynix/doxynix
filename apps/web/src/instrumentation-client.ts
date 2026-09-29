import * as Sentry from "@sentry/nextjs";
import posthog from "posthog-js";

import {
  API_PREFIX,
  NEXT_PUBLIC_POSTHOG_KEY,
  SENTRY_DSN,
  TRPC_PREFIX,
} from "./shared/config/env.client";
import { IS_DEV, IS_PROD } from "./shared/config/env.flags";
import { SENTRY_DATA_COLLECTION } from "./shared/config/sentry";

function escapeRegExp(str: string) {
  return str.replaceAll(/[$()*+.?[\\\]^{|}]/g, String.raw`\$&`);
}

/**
 * Integrations that pull in ~340 KB (Replay, httpClient, reportingObserver, browserTracing)
 * are registered after the first paint instead of at module scope. `Sentry.init` stays
 * eager so that errors thrown during hydration are still captured — the client exists,
 * it just has no heavy integrations yet.
 */
function afterFirstPaint(callback: () => void): void {
  if (typeof requestIdleCallback === "function") {
    requestIdleCallback(callback, { timeout: 2000 });
    return;
  }
  setTimeout(callback, 2000);
}

Sentry.init({
  dataCollection: SENTRY_DATA_COLLECTION,
  dsn: SENTRY_DSN,

  enabled: IS_PROD,

  enableLogs: !IS_PROD,

  replaysOnErrorSampleRate: 1,

  replaysSessionSampleRate: 0.01,

  tracesSampleRate: 0.1,

  tunnel: `${API_PREFIX}/dxnx/s`,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;

if (IS_PROD) {
  afterFirstPaint(() => {
    void (async () => {
      const {
        browserTracingIntegration,
        httpClientIntegration,
        reportingObserverIntegration,
        replayIntegration,
      } = await import("./shared/config/sentry-integrations");

      Sentry.addIntegration(
        replayIntegration({
          blockAllMedia: true,
          maskAllText: true,
        }),
      );
      Sentry.addIntegration(
        httpClientIntegration({
          failedRequestTargets: [
            new RegExp(`^${escapeRegExp(TRPC_PREFIX)}`),
            new RegExp(`^${escapeRegExp(API_PREFIX)}`),
          ],
        }),
      );
      Sentry.addIntegration(
        reportingObserverIntegration({ types: ["crash", "deprecation", "intervention"] }),
      );
      Sentry.addIntegration(browserTracingIntegration());
    })();
  });
}

// PostHog stays eager on purpose. `instrumentation-client` runs before React
// hydration (Next.js order: instrumentationClientInject -> this file -> hydration),
// and PostHog records route views and DOM interactions from the moment it boots, so
// deferring init here would silently drop the first view and the opening interaction
// window. The SDK is ~300 KB, but losing landing-page analytics is not worth 96 KB
// gzip. Only the Sentry integrations above are deferred: they have no first-paint
// semantics, and `replaysOnErrorSampleRate` still covers the gap because `init` ran.
if (IS_PROD) {
  posthog.init(NEXT_PUBLIC_POSTHOG_KEY, {
    api_host: `${API_PREFIX}/dxnx/p`,
    capture_exceptions: false,
    debug: IS_DEV,
    defaults: "2026-01-30",
    disable_session_recording: true,
    ui_host: "https://us.posthog.com",
  });
}
