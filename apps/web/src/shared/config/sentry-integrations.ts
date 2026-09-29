/**
 * Heavy Sentry integrations, kept in their own module so `import()` puts them in
 * a separate chunk instead of the initial payload.
 *
 * The factories are re-exported from `@sentry/nextjs` rather than reimplemented,
 * so the option types stay the ones the SDK documents.
 */
export {
  browserTracingIntegration,
  httpClientIntegration,
  replayIntegration,
  reportingObserverIntegration,
} from "@sentry/nextjs";
