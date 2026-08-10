import { APP_EVENTS, bus } from "@server/core/bus";
import type { Context } from "hono";
import { streamSSE } from "hono/streaming";

export async function handleLogStream(c: Context) {
  c.header("X-Accel-Buffering", "no");
  c.header("Cache-Control", "no-cache");

  return streamSSE(c, async (stream) => {
    const listener = async (data: { logs: Array<{ timestamp: string; message: string }> }) => {
      try {
        for (const log of data.logs) {
          await stream.writeSSE({
            event: "log",
            data: JSON.stringify(log),
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
        await stream.sleep(10000);
        await stream.writeSSE({ event: "ping", data: "keep-alive" });
      } catch {
        break;
      }
    }

    bus.off(APP_EVENTS.LOGS_INGESTED, listener);
  });
}
