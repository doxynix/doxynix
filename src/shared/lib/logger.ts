import { Logger } from "next-axiom";
import pino from "pino";

import { requestContext } from "@/server/utils/requestContext";

const isProd = process.env.NODE_ENV === "production";

type LogPayload = {
  msg: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
};

const pinoLogger = pino({
  level: "debug",
  transport: {
    target: "pino-pretty",
    options: { colorize: true, translateTime: "HH:MM:ss", ignore: "pid,hostname" },
  },
});

const axiomLogger = new Logger();

const withContext = (obj: LogPayload) => {
  const store = requestContext.getStore();
  return {
    ...store,
    ...obj,
  };
};
export const logger = {
  info: (obj: LogPayload) => {
    const payload = withContext(obj);
    if (isProd) {
      axiomLogger.info(payload.msg, payload);
    } else {
      pinoLogger.info(payload);
    }
  },
  error: (obj: LogPayload) => {
    const payload = withContext(obj);
    if (isProd) {
      axiomLogger.error(payload.msg, payload);
    } else {
      pinoLogger.error(payload);
    }
  },
  warn: (obj: LogPayload) => {
    const payload = withContext(obj);
    if (isProd) {
      axiomLogger.warn(payload.msg, payload);
    } else {
      pinoLogger.warn(payload);
    }
  },
  debug: (obj: LogPayload) => {
    const payload = withContext(obj);
    if (isProd) {
      axiomLogger.debug(payload.msg, payload);
    } else {
      pinoLogger.debug(payload);
    }
  },
  flush: async () => {
    if (isProd) await axiomLogger.flush();
  },
};
