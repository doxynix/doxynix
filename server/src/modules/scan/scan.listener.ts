import { APP_EVENTS, bus } from "@server/core/bus";
import { scanLogContent } from "@server/modules/scan/scan.service";

export function initScanEventListener() {
  bus.on(APP_EVENTS.LOGS_INGESTED, async (data) => {
    const { rawText, newestTimestamp, serializedState, serviceName } = data;
    if (rawText == null) return;

    const startTimeMs = performance.now();
    console.log(`[SIEM Engine] Analyzing logs...`);

    const scanResult = await scanLogContent(rawText, `axiom_${newestTimestamp}.log`, {
      serviceName,
      serializedPosition: serializedState,
    });

    const scanDurationMs = (performance.now() - startTimeMs).toFixed(1);
    if (!scanResult.isSafe) {
      console.warn(
        `[SIEM ALERT] Found ${scanResult.findings?.length} leak(s) in ${scanDurationMs}ms`,
      );
    }
  });
}
