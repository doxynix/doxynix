import { EventEmitter } from "eventemitter3";

export const APP_EVENTS = {
  LOGS_INGESTED: "logs:ingested",
} as const;

export type IngestedLogItem = {
  timestamp: string;
  message: string;
};

export type LogsIngestedPayload = {
  logs: IngestedLogItem[];
  rawText: string;
  newestTimestamp: string;
  serializedState: string;
  serviceName: string;
};

type EventTypes = {
  [APP_EVENTS.LOGS_INGESTED]: [data: LogsIngestedPayload];
};

class StrictEventEmitter extends EventEmitter<EventTypes> {}

export const bus = new StrictEventEmitter();
