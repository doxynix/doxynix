import { AsyncLocalStorage } from "node:async_hooks";

export interface RequestStore {
  requestId: string;
  userId?: number;
  userRole?: string;

  ip: string;
  userAgent: string;
  referer?: string;
  origin?: string;

  path: string;
  method: string;

  // appVersion?: string;
}

export const requestContext = new AsyncLocalStorage<RequestStore>();
