import EventEmitter from "eventemitter3";

export const APP_EVENTS = {
  LOGS_INGESTED: "logs:ingested",
} as const;

export const bus = new EventEmitter();
