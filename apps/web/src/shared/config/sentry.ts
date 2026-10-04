import type * as SentryNextJs from "@sentry/nextjs";

type SentryInitOptions = Parameters<typeof SentryNextJs.init>[0];

export const SENTRY_DATA_COLLECTION: NonNullable<SentryInitOptions>["dataCollection"] = {
  cookies: false,
  databaseQueryData: false,
  genAI: { inputs: false, outputs: false },
  graphQL: { document: false, variables: false },
  httpBodies: [],
  httpHeaders: false,
  queues: false,
  stackFrameVariables: false,
  urlQueryParams: false,
  userInfo: false,
};
