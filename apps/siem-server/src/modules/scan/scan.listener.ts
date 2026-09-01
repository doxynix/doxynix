import { APP_EVENTS, bus } from "@/core/bus";

import { scanLogContent } from "@/modules/scan/scan.service";

export function initScanEventListener() {
  bus.on(APP_EVENTS.LOGS_INGESTED, async (data) => {
    const { rawText, newestTimestamp, serializedState, serviceName } = data;
    if (rawText.length === 0) {
      return;
    }

    const startTimeMs = performance.now();
    console.warn(`[SIEM Engine] Analyzing logs...`);

    const scanResult = await scanLogContent(rawText, `axiom_${newestTimestamp}.log`, {
      serializedPosition: serializedState,
      serviceName,
    });

    const scanDurationMs = (performance.now() - startTimeMs).toFixed(1);
    if (!scanResult.isSafe) {
      console.warn(
        `[SIEM ALERT] Found ${scanResult.findings?.length} leak(s) in ${scanDurationMs}ms`,
      );
    }
  });
}
