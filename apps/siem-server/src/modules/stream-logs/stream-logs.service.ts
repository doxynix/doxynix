import type { Context } from "hono";
import { streamSSE } from "hono/streaming";

import { APP_EVENTS, bus, type LogsIngestedPayload } from "@/core/bus";

export async function handleLogStream(c: Context) {
  c.header("X-Accel-Buffering", "no");
  c.header("Cache-Control", "no-cache");

  return streamSSE(c, async (stream) => {
    const listener = async (data: LogsIngestedPayload) => {
      try {
        for (const log of data.logs) {
          await stream.writeSSE({
            data: JSON.stringify(log),
            event: "log",
          });
        }
      } catch {
        bus.off(APP_EVENTS.LOGS_INGESTED, listener);
      }
    };

    bus.on(APP_EVENTS.LOGS_INGESTED, listener);

    stream.onAbort(() => {
      bus.off(APP_EVENTS.LOGS_INGESTED, listener);
    });

    while (!stream.aborted) {
      try {
        await stream.sleep(10_000);
        await stream.writeSSE({ data: "keep-alive", event: "ping" });
      } catch {
        break;
      }
    }

    bus.off(APP_EVENTS.LOGS_INGESTED, listener);
  });
}
