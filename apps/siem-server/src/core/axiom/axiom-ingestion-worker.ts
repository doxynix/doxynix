import type { Entry } from "@axiomhq/js";
import { Temporal } from "@js-temporal/polyfill";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { axiom } from "@/core/axiom/axiom";
import { APP_EVENTS, bus } from "@/core/bus";
import { db } from "@/core/db/db";
import { cronSyncState } from "@/core/db/schema";
import { env } from "@/core/env";

const SERVICE_NAME = "axiom_log_ingestion";
const BATCH_LIMIT = 1000;
const DEFAULT_LOOKBACK_MINUTES = 60;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const cursorStateSchema = z.object({
  cursor: z.string().optional(),
  lastTime: z.string(),
});

type CursorState = z.infer<typeof cursorStateSchema>;

const logDataSchema = z.looseObject({
  content: z.string().optional(),
  durationMs: z.coerce.string().optional(),
  error: z
    .union([
      z.string(),
      z.object({
        kind: z.string().optional(),
        message: z.string().optional(),
        stack: z.string().optional(),
      }),
    ])
    .optional(),
  fields: z.record(z.string(), z.unknown()).optional(),
  message: z.string().optional(),
  model: z.string().optional(),
  msg: z.string().optional(),
  operation: z.string().optional(),
  raw: z.string().optional(),
  repoId: z.string().optional(),
  type: z.string().optional(),
  userId: z.string().optional(),
});

function formatMessage(match: Entry): string {
  const data = logDataSchema.parse(match.data);
  const fields = data.fields ? logDataSchema.parse(data.fields) : data;

  const msg = data.message ?? fields.msg ?? data.raw ?? data.content ?? "";

  const type = fields.type ? `[${fields.type}]` : "";
  const duration = fields.durationMs ? `${fields.durationMs}ms` : "";
  const modelOp = fields.model && fields.operation ? `(${fields.model}.${fields.operation})` : "";
  const userId = fields.userId ? `user:${fields.userId}` : "";
  const repoId = fields.repoId ? `repo:${fields.repoId}` : "";

  let errorDetails = "";
  let stacktrace = "";

  if (typeof fields.error === "object") {
    const kind = fields.error.kind ?? "Error";
    const errorMessage = fields.error.message ?? "";
    errorDetails = errorMessage ? `${kind}: ${errorMessage}` : kind;
    stacktrace = fields.error.stack ?? "";
  } else if (typeof fields.error === "string") {
    errorDetails = fields.error;
  }

  const badges = [type, modelOp, duration, userId, repoId].filter(Boolean).join(" ");
  const header = badges ? `${badges} -> ${msg}` : msg;

  const lines: string[] = [header];

  if (errorDetails && !msg.includes(errorDetails)) {
    lines.push(`❌ ${errorDetails}`);
  }

  if (stacktrace) {
    lines.push(`Stacktrace:\n${stacktrace}`);
  }

  return lines.join("\n");
}

async function getLastSyncedState(): Promise<CursorState> {
  const [syncState] = await db
    .select({ position: cronSyncState.lastSyncedPosition })
    .from(cronSyncState)
    .where(eq(cronSyncState.serviceName, SERVICE_NAME));

  if (syncState?.position) {
    try {
      const parsed: unknown = JSON.parse(syncState.position);
      const validated = cursorStateSchema.safeParse(parsed);
      if (validated.success) {
        return validated.data;
      }
      return { lastTime: syncState.position };
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

  console.warn(`[Axiom Sync] Querying dataset '${env.AXIOM_DATASET}' from ${lastTime}...`);

  const queryOptions = lastCursor ? { cursor: lastCursor } : undefined;
  const response = await axiom.query(aplQuery, queryOptions);

  if (!response.matches || response.matches.length === 0) {
    console.warn("[Axiom Sync] No new logs found. Up to date.");
    return { hasMore: false, processedCount: 0 };
  }

  const matches: Entry[] = response.matches;
  let newestTimestamp = lastTime;

  const parsedLogs = matches
    .map((match) => {
      const time = match._time;
      if (time > newestTimestamp) {
        newestTimestamp = time;
      }
      return {
        message: formatMessage(match),
        timestamp: time,
      };
    })
    .filter((l) => l.message.trim() !== "");

  const nextCursor = response.status.maxCursor;
  const serializedState = JSON.stringify({
    cursor: nextCursor,
    lastTime: newestTimestamp,
  });

  bus.emit(APP_EVENTS.LOGS_INGESTED, {
    logs: parsedLogs,
    newestTimestamp,
    rawText: parsedLogs.map((l) => l.message).join("\n"),
    serializedState,
    serviceName: SERVICE_NAME,
  });

  return {
    hasMore: matches.length >= BATCH_LIMIT,
    processedCount: matches.length,
  };
}

export async function startAxiomIngestionWorker(): Promise<void> {
  console.warn("[Axiom Worker] Starting SIEM Ingestion Daemon...");
  while (true) {
    try {
      const { hasMore } = await runAxiomSyncCycle();
      if (hasMore) {
        continue;
      }
      await sleep(10_000);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[Axiom Worker Error] Sync cycle failed: ${errorMessage}. Retrying in 15s...`);
      await sleep(15_000);
    }
  }
}
