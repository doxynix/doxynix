import { headers } from "next/headers";
import { BannedEmailReason } from "@doxynix/shared";
import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/webhooks/resend/route";
import { prisma } from "@/server/core/db";

const { mockAppLogger, svixVerifyMock } = vi.hoisted(() => ({
  mockAppLogger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
  svixVerifyMock: vi.fn(),
}));

vi.mock("next/headers", () => ({ headers: vi.fn() }));

vi.mock("svix", () => ({
  Webhook: class {
    verify = svixVerifyMock;
  },
}));

vi.mock("@/server/core/app-logger", () => ({ appLogger: mockAppLogger }));

vi.mock("@/server/core/db", () => ({
  prisma: {
    $transaction: vi.fn(),
    bannedEmail: { upsert: vi.fn() },
    webhookDelivery: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  },
}));

const p2002 = () =>
  new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
    clientVersion: "6.19.3",
    code: "P2002",
  });

const svixHeaders = (overrides: Record<string, string> = {}) => ({
  "svix-id": "svix_1",
  "svix-signature": "v1,abc",
  "svix-timestamp": "2026-09-13T10:00:00Z",
  ...overrides,
});

/** Parsed payload the svix verify mock returns (must satisfy resendWebhookSchema). */
const verifiedPayload = (overrides: Record<string, unknown> = {}) => ({
  created_at: "2026-09-13T10:00:00.000Z",
  data: {
    email_id: "email_1",
    to: ["bounced@example.com"],
  },
  type: "email.bounced",
  ...overrides,
});

const makeReq = (body?: string) =>
  new Request("http://localhost/api/webhooks/resend", {
    body,
    headers: { "content-type": "application/json" },
    method: "POST",
  });

describe("POST /api/webhooks/resend", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(headers).mockResolvedValue(new Headers(svixHeaders()));
    svixVerifyMock.mockReturnValue(verifiedPayload());
    vi.mocked(prisma.webhookDelivery.create).mockResolvedValue({ id: "del-1" } as never);
    vi.mocked(prisma.webhookDelivery.update).mockResolvedValue({ id: "del-1" } as never);
    vi.mocked(prisma.$transaction).mockResolvedValue([]);
    vi.mocked(prisma.bannedEmail.upsert).mockResolvedValue({ id: 1 } as never);
  });

  it("returns 400 when svix headers are missing", async () => {
    vi.mocked(headers).mockResolvedValue(new Headers());
    const res = await POST(makeReq("{}"));
    expect(res.status).toBe(400);
    await expect(res.text()).resolves.toBe("Missing svix headers");
  });

  it("returns 400 when signature verification fails", async () => {
    svixVerifyMock.mockImplementation(() => {
      throw new Error("bad signature");
    });
    const res = await POST(makeReq(JSON.stringify({})));
    expect(res.status).toBe(400);
    await expect(res.text()).resolves.toBe("Verify failed");
  });

  it("returns 400 when the verified payload fails the schema", async () => {
    svixVerifyMock.mockReturnValue({ not: "a-resend-event" });
    const res = await POST(makeReq(JSON.stringify({})));
    expect(res.status).toBe(400);
    await expect(res.text()).resolves.toBe("Invalid payload structure");
  });

  it("returns already-processed when the existing delivery is SUCCESS", async () => {
    vi.mocked(prisma.webhookDelivery.create).mockRejectedValue(p2002());
    vi.mocked(prisma.webhookDelivery.findUnique).mockResolvedValue({
      id: "del-1",
      status: "SUCCESS",
    } as never);

    const res = await POST(makeReq(JSON.stringify(verifiedPayload())));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ msg: "Already processed", ok: true });
    expect(prisma.webhookDelivery.update).not.toHaveBeenCalled();
  });

  it("returns 202 while a delivery is still PROCESSING", async () => {
    vi.mocked(prisma.webhookDelivery.create).mockRejectedValue(p2002());
    vi.mocked(prisma.webhookDelivery.findUnique).mockResolvedValue({
      id: "del-1",
      status: "PROCESSING",
    } as never);

    const res = await POST(makeReq(JSON.stringify(verifiedPayload())));

    expect(res.status).toBe(202);
    await expect(res.text()).resolves.toBe("Processing in progress");
  });

  it("resets a FAILED delivery to PROCESSING and processes the event", async () => {
    vi.mocked(prisma.webhookDelivery.create).mockRejectedValue(p2002());
    vi.mocked(prisma.webhookDelivery.findUnique).mockResolvedValue({
      id: "del-1",
      status: "FAILED",
    } as never);

    const res = await POST(makeReq(JSON.stringify(verifiedPayload())));

    expect(res.status).toBe(200);
    expect(prisma.webhookDelivery.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { error: null, status: "PROCESSING" } }),
    );
    expect(prisma.$transaction).toHaveBeenCalled();
  });

  it("returns 500 on a non-dedupe DB error", async () => {
    vi.mocked(prisma.webhookDelivery.create).mockRejectedValue(new Error("db down"));
    const res = await POST(makeReq(JSON.stringify(verifiedPayload())));
    expect(res.status).toBe(500);
    await expect(res.text()).resolves.toBe("DB Error");
  });

  it("bans the email and marks the delivery SUCCESS on email.bounced", async () => {
    const res = await POST(makeReq(JSON.stringify(verifiedPayload())));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
    expect(prisma.bannedEmail.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: { email: "bounced@example.com", reason: BannedEmailReason.BOUNCED },
        update: { reason: BannedEmailReason.BOUNCED },
      }),
    );
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it("maps email.complained to COMPLAINED", async () => {
    svixVerifyMock.mockReturnValue(verifiedPayload({ type: "email.complained" }));
    const res = await POST(makeReq(JSON.stringify(verifiedPayload({ type: "email.complained" }))));

    expect(res.status).toBe(200);
    expect(prisma.bannedEmail.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ reason: BannedEmailReason.COMPLAINED }),
      }),
    );
  });

  it("returns 400 and fails the delivery when the recipient is missing", async () => {
    svixVerifyMock.mockReturnValue(verifiedPayload({ data: { email_id: "email_1", to: [] } }));
    const res = await POST(
      makeReq(JSON.stringify(verifiedPayload({ data: { email_id: "email_1", to: [] } }))),
    );

    expect(res.status).toBe(400);
    await expect(res.text()).resolves.toBe("Invalid payload");
    expect(prisma.webhookDelivery.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "FAILED" }) }),
    );
  });

  it("does not ban when the event type is not in the reason map", async () => {
    svixVerifyMock.mockReturnValue(verifiedPayload({ type: "email.opened" }));
    const res = await POST(makeReq(JSON.stringify(verifiedPayload({ type: "email.opened" }))));

    expect(res.status).toBe(200);
    expect(prisma.bannedEmail.upsert).not.toHaveBeenCalled();
    expect(prisma.webhookDelivery.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { error: null, status: "SUCCESS" } }),
    );
  });

  it("returns 500 and fails the delivery when the ban transaction rejects", async () => {
    vi.mocked(prisma.$transaction).mockRejectedValue(new Error("txn boom"));
    const res = await POST(makeReq(JSON.stringify(verifiedPayload())));

    expect(res.status).toBe(500);
    await expect(res.text()).resolves.toBe("Internal Error");
    expect(prisma.webhookDelivery.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "FAILED" }) }),
    );
  });
});
