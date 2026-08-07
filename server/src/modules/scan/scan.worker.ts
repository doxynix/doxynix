import type { Entry } from "@axiomhq/js";
import { axiom } from "@server/core/axiom";
import { db } from "@server/core/db/db";
import { cronSyncState } from "@server/core/db/schema";
import { env } from "@server/core/env";
import { scanLogContent } from "@server/modules/scan/scan.service";
import { eq } from "drizzle-orm";

const SERVICE_NAME = "axiom_log_ingestion";
const BATCH_LIMIT = 1000;
const DEFAULT_LOOKBACK_MINUTES = 60;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type CursorState = {
  lastTime: string;
  cursor?: string | undefined;
};

async function getLastSyncedState(): Promise<CursorState> {
  const [syncState] = await db
    .select({ position: cronSyncState.lastSyncedPosition })
    .from(cronSyncState)
    .where(eq(cronSyncState.serviceName, SERVICE_NAME));

  if (syncState?.position != null) {
    try {
      const parsed = JSON.parse(syncState.position);
      if (parsed.lastTime != null) return parsed;
    } catch {
      return { lastTime: syncState.position };
    }
  }

  const lookbackDuration = Temporal.Duration.from({ minutes: DEFAULT_LOOKBACK_MINUTES });
  const fallbackInstant = Temporal.Now.instant().subtract(lookbackDuration);

  return { lastTime: fallbackInstant.toString() };
}

type SyncCycle = { processedCount: number; hasMore: boolean };

async function runAxiomSyncCycle(): Promise<SyncCycle> {
  const { lastTime, cursor: lastCursor } = await getLastSyncedState();

  const aplQuery = `
    ['${env.AXIOM_DATASET}']
    | where _time >= datetime('${lastTime}')
    | where not(message contains '/ping' or message contains '/health' or message contains 'favicon.ico')
    | sort by _time asc
    | limit ${BATCH_LIMIT}
  `;

  const startTimeMs = performance.now();
  console.log(`🔍 [Axiom Sync] Querying dataset '${env.AXIOM_DATASET}' from ${lastTime}...`);

  const queryOptions = lastCursor != null ? { cursor: lastCursor } : undefined;
  const response = await axiom.query(aplQuery, queryOptions);

  if (response.matches == null || response.matches.length === 0) {
    console.log(`💤 [Axiom Sync] No new logs found. Up to date.`);
    return { processedCount: 0, hasMore: false };
  }

  const matches: Entry[] = response.matches;
  const logLines: string[] = [];
  let newestTimestamp = lastTime;

  for (const match of matches) {
    const itemTime = match._time;
    if (itemTime != null && itemTime > newestTimestamp) {
      newestTimestamp = itemTime;
    }

    const messageText = match.data?.message ?? match.data?.raw ?? match.data?.content;
    if (messageText != null) {
      logLines.push(String(messageText));
    }
  }

  const nextCursor = response.status?.maxCursor ?? undefined;
  const serializedState = JSON.stringify({
    lastTime: newestTimestamp,
    cursor: nextCursor,
  });

  console.log(`⚡ [SIEM Engine] Analyzing ${logLines.length} log line(s)...`);

  const scanResult = await scanLogContent(
    logLines.join("\n"),
    `axiom_${env.AXIOM_DATASET}_${newestTimestamp}.log`,
    {
      serviceName: SERVICE_NAME,
      serializedPosition: serializedState,
    },
  );

  const scanDurationMs = (performance.now() - startTimeMs).toFixed(1);

  if (scanResult.isSafe) {
    console.log(`✅ [SIEM Engine] Scan clean (${scanDurationMs}ms). Checkpoint updated.`);
  } else {
    console.warn(
      `🚨 [SIEM ALERT] SECURITY INCIDENT CREATED! Found ${scanResult.findings?.length ?? 0} leak(s) in ${scanDurationMs}ms`,
    );
  }

  return { processedCount: matches.length, hasMore: matches.length >= BATCH_LIMIT };
}

export async function startAxiomIngestionWorker(): Promise<void> {
  console.log(`🚀 [Axiom Worker] Starting SIEM Ingestion Daemon...`);
  while (true) {
    try {
      const { hasMore } = await runAxiomSyncCycle();
      if (hasMore) continue;
      await sleep(10_000);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(
        `❌ [Axiom Worker Error] Sync cycle failed: ${errorMessage}. Retrying in 15s...`,
      );
      await sleep(15_000);
    }
  }
}
