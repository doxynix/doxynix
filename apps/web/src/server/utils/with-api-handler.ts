import { IS_PROD } from "@/shared/config/env.flags";

import { appLogger } from "@/server/core/app-logger";

import {
  type AppError,
  type ErrorMapping,
  isNextControlFlowError,
  normalizeError,
  toErrorResponse,
} from "./api-error";
import { buildRequestStore, requestContext } from "./request-context";

type Options = {
  /**
   * Domain-specific copy for expected failures thrown by this route, e.g.
   * `{ notFound: "Repository not found" }`. Applied to Prisma failures by
   * column-specific keys, exactly as `handlePrismaError` does for tRPC.
   */
  map?: ErrorMapping;
  /** Route label used in log lines, when the path alone is not distinctive. */
  scope?: string;
};

/**
 * Log line for a caught error. `isUnexpected` is the signal that matters: it is
 * set only when the thrown value was not a recognized, expected failure, so
 * this warns on the ones that need attention instead of logging every 404 a
 * crawler produces as an error.
 */
function reportError(error: AppError, scope: string | undefined) {
  const meta = {
    code: error.code,
    kind: error.kind,
    msg: `Unhandled API error${scope == null ? "" : ` in ${scope}`}`,
    source: error.source,
    unexpected: error.isUnexpected,
  };

  if (error.isUnexpected) {
    appLogger.error({ ...meta, error });
    return;
  }

  appLogger.warn({ ...meta, msg: `API error${scope == null ? "" : ` in ${scope}`}` });
}

/**
 * The single entry point for route-handler error handling.
 *
 * It does three things no route was doing consistently before:
 *
 * 1. **Establishes `requestContext`.** Ten of the sixteen route handlers never
 *    did, so their `appLogger` lines had no `requestId`/`userId` and could not
 *    be correlated with anything. The store is reused when an outer layer
 *    already created one (the tRPC adapter and both webhooks do), so this never
 *    clobbers a richer store.
 * 2. **Re-throws Next control-flow errors.** `redirect()` and friends throw
 *    rather than return; converting them to a JSON 500 would break
 *    `/api/github/setup`.
 * 3. **Normalizes, logs once, and serializes** every other throw into the
 *    single `{ error: { code, message, requestId } }` shape.
 *
 * Expected failures should be thrown as `AppError` (or returned as an early
 * `NextResponse`) and will be logged at `warn`; genuine bugs are logged at
 * `error` with their original cause intact.
 *
 * `Req` defaults to `Request`, so a zero-argument handler (a route that reads
 * only `headers()`) infers correctly instead of failing the `extends Request`
 * constraint, while a handler that declares `NextRequest` still gets it
 * inferred from its parameter.
 */
export function withApiHandler<Req extends Request = Request>(
  handler: (req: Req) => Promise<Response>,
  options: Options = {},
): (req: Req) => Promise<Response> {
  return async (req) => {
    const store =
      requestContext.getStore() ??
      buildRequestStore({
        method: req.method,
        path: new URL(req.url).pathname,
        req,
      });

    return requestContext.run(store, async () => {
      try {
        return await handler(req);
      } catch (error) {
        if (isNextControlFlowError(error)) {
          throw error;
        }

        const normalized = normalizeError(error, options.map);
        reportError(normalized, options.scope);

        // Axiom buffers, and a frozen serverless instance can lose the line
        // that records a 500. Gated on `IS_PROD` for the same reason
        // `loggerMiddleware` in `core/trpc/init.ts` is: the dev logger writes
        // synchronously and has nothing to flush.
        if (IS_PROD && normalized.isUnexpected) {
          await appLogger.flush();
        }

        return toErrorResponse(normalized);
      }
    });
  };
}
