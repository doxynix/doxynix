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
  map?: ErrorMapping;
  scope?: string;
};

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

        if (IS_PROD && normalized.isUnexpected) {
          await appLogger.flush();
        }

        return toErrorResponse(normalized);
      }
    });
  };
}
