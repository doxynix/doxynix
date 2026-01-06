import { AsyncLocalStorage } from "node:async_hooks";

export interface RequestInfo {
  ip: string;
  userAgent: string;
}

export const requestContext = new AsyncLocalStorage<RequestInfo>();
