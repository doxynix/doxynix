import { Logger } from "next-axiom";
import pino from "pino";
import pretty from "pino-pretty";

import { requestContext } from "@/server/utils/request-context";

import { IS_PROD } from "../../shared/constants/env.client";

type LogPayload = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
  msg: string;
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

const withContext = (obj: LogPayload) => {
  const store = requestContext.getStore();
  if (obj.error instanceof Error) {
    obj.error = {
      kind: obj.error.name,
      message: obj.error.message,
      stack: obj.error.stack,
    };
  }

  return {
    ...store,
    ...obj,
  };
};

export const logger = {
  debug: (payload: LogPayload) => {
    const data = withContext(payload);
    if (IS_PROD && axiomLogger) {
      axiomLogger.debug(data.msg, data);
    } else {
      const { msg, ...rest } = data;
      pinoLogger.debug(rest, msg);
    }
  },
  error: (payload: LogPayload) => {
    const data = withContext(payload);
    if (IS_PROD && axiomLogger) {
      axiomLogger.error(data.msg, data);
    } else {
      const { msg, ...rest } = data;
      pinoLogger.error(rest, msg);
    }
  },
  flush: async () => {
    if (IS_PROD && axiomLogger) await axiomLogger.flush();
  },
  info: (payload: LogPayload) => {
    const data = withContext(payload);
    if (IS_PROD && axiomLogger) {
      axiomLogger.info(data.msg, data);
    } else {
      const { msg, ...rest } = data;
      pinoLogger.info(rest, msg);
    }
  },
  warn: (payload: LogPayload) => {
    const data = withContext(payload);
    if (IS_PROD && axiomLogger) {
      axiomLogger.warn(data.msg, data);
    } else {
      const { msg, ...rest } = data;
      pinoLogger.warn(rest, msg);
    }
  },
};
