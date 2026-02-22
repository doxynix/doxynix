import { AsyncLocalStorage } from "node:async_hooks";

export interface RequestStore {
  ip: string;
  method: string;
  origin?: string;

  path: string;
  referer?: string;
  requestId: string;
  userAgent: string;

  userId?: number;
  userRole?: string;

  // appVersion?: string;
}

export const requestContext = new AsyncLocalStorage<RequestStore>();
