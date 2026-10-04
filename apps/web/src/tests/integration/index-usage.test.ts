import { beforeEach, describe, expect, it } from "vitest";

import { prisma } from "@/server/core/db";

import { cleanupDatabase, createTestUser } from "../helpers";

// `EXPLAIN (FORMAT JSON)` nests the root node under `Plan` and children under `Plans`.
type PlanNode = { "Index Name"?: string; "Node Type": string; Plan?: PlanNode; Plans?: PlanNode[] };

type ExplainResult = { Plan: PlanNode };

type ExplainRow = { "QUERY PLAN": ExplainResult[] };

function collectIndexNames(results: ExplainResult[]): string[] {
  return results.flatMap((result) => collectNodeIndexNames(result.Plan));
}

function collectNodeIndexNames(node: PlanNode | undefined): string[] {
  if (node == null) {
    return [];
  }
  return [
    ...(node["Index Name"] == null ? [] : [node["Index Name"]]),
    ...(node.Plans ?? []).flatMap((child) => collectNodeIndexNames(child)),
  ];
}

const ROWS_FOR_MEANINGFUL_PLAN = 20_000;
const EXPIRED_ROWS = 200;

describe("index usage", () => {
  beforeEach(async () => {
    await cleanupDatabase();
  });

  it("indexes chat_sessions for the list-sessions query", async () => {
    const indexes = await prisma.$queryRaw<Array<{ indexname: string }>>`
      SELECT indexname::text FROM pg_indexes WHERE tablename = 'chat_sessions';`;
    expect(indexes.map((row) => row.indexname)).toContain("chat_sessions_user_id_updated_at_idx");

    const alice = await createTestUser("Alice");
    const rows = Array.from({ length: ROWS_FOR_MEANINGFUL_PLAN }, (_, i) => ({
      createdAt: new Date(Date.now() - i * 1000),
      title: `chat ${i}`,
      updatedAt: new Date(Date.now() - i * 1000),
      userId: alice.user.id,
    }));
    await prisma.chatSession.createMany({ data: rows });
    await prisma.$executeRawUnsafe("ANALYZE chat_sessions;");

    const plan = await prisma.$queryRaw<ExplainRow[]>`
      EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
      SELECT id FROM chat_sessions WHERE user_id = ${alice.user.id}::uuid ORDER BY updated_at DESC LIMIT 20;`;

    expect(collectIndexNames(plan[0]?.["QUERY PLAN"] ?? [])).toContain(
      "chat_sessions_user_id_updated_at_idx",
    );
  });

  it("indexes chat_messages for the session-history query", async () => {
    const indexes = await prisma.$queryRaw<Array<{ indexname: string }>>`
      SELECT indexname::text FROM pg_indexes WHERE tablename = 'chat_messages';`;
    expect(indexes.map((row) => row.indexname)).toContain(
      "chat_messages_session_id_created_at_idx",
    );

    const alice = await createTestUser("Alice");
    const session = await prisma.chatSession.create({
      data: { title: "history", userId: alice.user.id },
    });
    await prisma.chatMessage.createMany({
      data: Array.from({ length: ROWS_FOR_MEANINGFUL_PLAN }, (_, i) => ({
        createdAt: new Date(Date.now() - i * 1000),
        parts: "x",
        role: "user",
        sessionId: session.id,
      })),
    });
    await prisma.$executeRawUnsafe("ANALYZE chat_messages;");

    const plan = await prisma.$queryRaw<ExplainRow[]>`
      EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
      SELECT id FROM chat_messages WHERE session_id = ${session.id}::uuid ORDER BY created_at ASC;`;

    expect(collectIndexNames(plan[0]?.["QUERY PLAN"] ?? [])).toContain(
      "chat_messages_session_id_created_at_idx",
    );
  });

  it("indexes sessions.expiresAt for the nightly cleanup", async () => {
    const indexes = await prisma.$queryRaw<Array<{ indexname: string }>>`
      SELECT indexname::text FROM pg_indexes WHERE tablename = 'sessions';`;
    expect(indexes.map((row) => row.indexname)).toContain("sessions_expires_at_idx");

    // Only a small expired tail, matching the nightly cleanup: seeding every row as
    // expired would make a full-table delete, which a sequential scan legitimately wins.
    const alice = await createTestUser("Alice");
    await prisma.$executeRawUnsafe(`
      INSERT INTO sessions (id, expires_at, token, user_id, created_at, updated_at, ip_address, user_agent)
      SELECT gen_random_uuid(),
             NOW() + CASE WHEN i <= ${EXPIRED_ROWS} THEN -(i || ' minutes')::interval
                          ELSE (i || ' minutes')::interval END,
             'tok-' || i, '${alice.user.id}'::uuid, NOW(), NOW(), '127.0.0.1', 'seed'
      FROM generate_series(1, ${ROWS_FOR_MEANINGFUL_PLAN}) AS i;
    `);
    await prisma.$executeRawUnsafe("ANALYZE sessions;");

    const plan = await prisma.$queryRaw<ExplainRow[]>`
      EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
      DELETE FROM sessions WHERE expires_at < NOW();`;

    expect(collectIndexNames(plan[0]?.["QUERY PLAN"] ?? [])).toContain("sessions_expires_at_idx");
  });

  it("indexes verification_tokens.expiresAt for the nightly cleanup", async () => {
    const indexes = await prisma.$queryRaw<Array<{ indexname: string }>>`
      SELECT indexname::text FROM pg_indexes WHERE tablename = 'verification_tokens';`;
    expect(indexes.map((row) => row.indexname)).toContain("verification_tokens_expires_at_idx");

    // `value_hash` is unique and defaults to "", so it needs a distinct value per row.
    await prisma.$executeRawUnsafe(`
      INSERT INTO verification_tokens (id, identifier, identifier_hash, value, value_hash, expires_at, created_at, updated_at)
      SELECT gen_random_uuid(), 'id-' || i, 'idh-' || i, 'val-' || i, 'vh-' || i,
             NOW() + CASE WHEN i <= ${EXPIRED_ROWS} THEN -(i || ' minutes')::interval
                          ELSE (i || ' minutes')::interval END,
             NOW(), NOW()
      FROM generate_series(1, ${ROWS_FOR_MEANINGFUL_PLAN}) AS i;
    `);
    await prisma.$executeRawUnsafe("ANALYZE verification_tokens;");

    const plan = await prisma.$queryRaw<ExplainRow[]>`
      EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
      DELETE FROM verification_tokens WHERE expires_at < NOW();`;

    expect(collectIndexNames(plan[0]?.["QUERY PLAN"] ?? [])).toContain(
      "verification_tokens_expires_at_idx",
    );
  });
});
