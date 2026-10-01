// Re-exported (not reimplemented) so dynamic import chunks them separately and the option types stay the SDK's.
export {
  browserTracingIntegration,
  httpClientIntegration,
  replayIntegration,
  reportingObserverIntegration,
} from "@sentry/nextjs";
