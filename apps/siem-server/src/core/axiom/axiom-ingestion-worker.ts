import type { Entry } from "@axiomhq/js";
import { Temporal } from "@js-temporal/polyfill";
import { axiom } from "@server/core/axiom/axiom";
import { APP_EVENTS, bus } from "@server/core/bus";
import { db } from "@server/core/db/db";
import { cronSyncState } from "@server/core/db/schema";
import { env } from "@server/core/env";
import { eq } from "drizzle-orm";

const SERVICE_NAME = "axiom_log_ingestion";
const BATCH_LIMIT = 1000;
const DEFAULT_LOOKBACK_MINUTES = 60;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type CursorState = {
  lastTime: string;
  cursor?: string;
};

function formatMessage(match: Entry): string {
  const data = (match.data ?? {}) as Record<string, unknown>;
  const fields = (data.fields ?? data) as Record<string, unknown>;

  const msg = String(data.message ?? fields.msg ?? data.raw ?? data.content ?? "");

  const type = fields.type ? `[${fields.type}]` : "";
  const duration = fields.durationMs ? `${fields.durationMs}ms` : "";
  const modelOp = fields.model && fields.operation ? `(${fields.model}.${fields.operation})` : "";
  const userId = fields.userId ? `user:${fields.userId}` : "";
  const repoId = fields.repoId ? `repo:${fields.repoId}` : "";

  const errObj = (fields.error ?? data.error) as
    | { kind?: string; message?: string; stack?: string }
    | string
    | undefined;

  let errorDetails = "";
  let stacktrace = "";

  if (typeof errObj === "object" && errObj != null) {
    if (errObj.message != null) errorDetails = `${errObj.kind ?? "Error"}: ${errObj.message}`;
    if (errObj.stack != null) stacktrace = errObj.stack;
  } else if (typeof errObj === "string") {
    errorDetails = errObj;
  }

  const badges = [type, modelOp, duration, userId, repoId].filter(Boolean).join(" ");
  const header = badges ? `${badges} -> ${msg}` : msg;

  const lines: string[] = [header];

  if (errorDetails != null && !msg.includes(errorDetails)) {
    lines.push(`❌ ${errorDetails}`);
  }

  if (stacktrace != null) {
    lines.push(`Stacktrace:\n${stacktrace}`);
  }

  return lines.join("\n");
}

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

  const fallbackInstant = Temporal.Now.instant().subtract({
    minutes: DEFAULT_LOOKBACK_MINUTES,
  });

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

  console.log(`[Axiom Sync] Querying dataset '${env.AXIOM_DATASET}' from ${lastTime}...`);

  const queryOptions = lastCursor != null ? { cursor: lastCursor } : undefined;
  const response = await axiom.query(aplQuery, queryOptions);

  if (response.matches == null || response.matches.length === 0) {
    console.log(`[Axiom Sync] No new logs found. Up to date.`);
    return { processedCount: 0, hasMore: false };
  }

  const matches: Entry[] = response.matches;
  let newestTimestamp = lastTime;

  const parsedLogs = matches
    .map((match) => {
      if (match._time != null && match._time > newestTimestamp) {
        newestTimestamp = match._time;
      }
      return {
        timestamp: match._time ?? new Date().toISOString(),
        message: formatMessage(match),
      };
    })
    .filter((l) => l.message.trim() !== "");

  const nextCursor = response.status?.maxCursor ?? undefined;
  const serializedState = JSON.stringify({
    lastTime: newestTimestamp,
    cursor: nextCursor,
  });

  bus.emit(APP_EVENTS.LOGS_INGESTED, {
    logs: parsedLogs,
    rawText: parsedLogs.map((l) => l.message).join("\n"),
    newestTimestamp,
    serializedState,
    serviceName: SERVICE_NAME,
  });

  return {
    processedCount: matches.length,
    hasMore: matches.length >= BATCH_LIMIT,
  };
}

export async function startAxiomIngestionWorker(): Promise<void> {
  console.log(`[Axiom Worker] Starting SIEM Ingestion Daemon...`);
  while (true) {
    try {
      const { hasMore } = await runAxiomSyncCycle();
      if (hasMore) continue;
      await sleep(10_000);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[Axiom Worker Error] Sync cycle failed: ${errorMessage}. Retrying in 15s...`);
      await sleep(15_000);
    }
  }
}
