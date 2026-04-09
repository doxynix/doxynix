import { Logger } from "next-axiom";
import pino from "pino";
import pretty from "pino-pretty";

import { IS_PROD } from "@/shared/constants/env.client";
import { sanitizePayload } from "@/shared/lib/utils";

import { requestContext } from "@/server/shared/lib/request-context";

type SerializedError = {
  kind: string;
  message: string;
  stack?: string;
};

type LogPayload = Record<string, unknown> & {
  error?: Error | unknown;
  msg: string;
};

const prepareData = (payload: LogPayload) => {
  const store = requestContext.getStore();

  const rawData = { ...store, ...payload };

  if (rawData.error instanceof Error) {
    rawData.error = {
      kind: rawData.error.name,
      message: rawData.error.message,
      stack: rawData.error.stack,
    } satisfies SerializedError;
  }

  return sanitizePayload(rawData) as Record<string, unknown>;
};

const createPinoLogger = () => {
  if (IS_PROD) {
    return pino({ level: "info" });
  }

  const stream = pretty({
    colorize: true,
    ignore: "pid,hostname",
    messageKey: "msg",
    translateTime: "HH:MM:ss",
  });

  return pino(
    {
      base: undefined,
      level: "debug",
    },
    stream
  );
};

const pinoLogger = createPinoLogger();

const axiomLogger = IS_PROD ? new Logger() : null;

const log = (level: "debug" | "info" | "warn" | "error", payload: LogPayload) => {
  const data = prepareData(payload);
  const { msg, ...rest } = data;

  const message = String(msg);

  if (IS_PROD && axiomLogger) {
    axiomLogger[level](message, rest);
  } else {
    pinoLogger[level](rest, message);
  }
};

export const logger = {
  debug: (payload: LogPayload) => log("debug", payload),
  error: (payload: LogPayload) => log("error", payload),
  flush: async () => {
    if (IS_PROD && axiomLogger) {
      await axiomLogger.flush();
    }
  },
  info: (payload: LogPayload) => log("info", payload),

  warn: (payload: LogPayload) => log("warn", payload),
};
