import type * as SentryNextJs from "@sentry/nextjs";

type ReplayIntegrationOptions = NonNullable<Parameters<typeof SentryNextJs.replayIntegration>[0]>;

export const SENTRY_REPLAY_INTEGRATION_OPTIONS = {
  blockAllMedia: true,
  maskAllInputs: true,
  maskAllText: true,
} satisfies ReplayIntegrationOptions;
