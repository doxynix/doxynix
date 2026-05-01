import { headers } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { BannedEmailReason, Prisma } from "@prisma/client";
import { Webhook } from "svix";

import { RESEND_WEBHOOK_SECRET } from "@/shared/constants/env.server";

import { prisma } from "@/server/shared/infrastructure/db";
import { logger } from "@/server/shared/infrastructure/logger";
import { normalizeEmail } from "@/server/shared/lib/email-guard";
import { buildRequestStore, requestContext } from "@/server/shared/lib/request-context";

type ResendWebhookType =
  | "email.bounced"
  | "email.clicked"
  | "email.complained"
  | "email.delivered"
  | "email.delivery_delayed"
  | "email.failed"
  | "email.opened"
  | "email.sent"
  | "email.suppressed";

type ResendWebhookEvent = {
  created_at: string;
  data: {
    bounce?: { sub_type: string; type: string };
    created_at: string;
    email_id: string;
    from: string;
    subject: string;
    to: string[];
  };
  id: string;
  type: ResendWebhookType | string;
};

export async function POST(req: Request) {
  const payload = await req.text();
  const headerPayload = await headers();

  const svix_id = headerPayload.get("svix-id");
  const svix_timestamp = headerPayload.get("svix-timestamp");
  const svix_signature = headerPayload.get("svix-signature");

  if (svix_id == null || svix_timestamp == null || svix_signature == null) {
    return new NextResponse("Missing svix headers", { status: 400 });
  }

  const wh = new Webhook(RESEND_WEBHOOK_SECRET);
  let evt: ResendWebhookEvent;

  try {
    evt = wh.verify(payload, {
      "svix-id": svix_id,
      "svix-signature": svix_signature,
      "svix-timestamp": svix_timestamp,
    }) as ResendWebhookEvent;
  } catch {
    return new NextResponse("Verify failed", { status: 400 });
  }

  const store = buildRequestStore({
    method: "webhook",
    path: "/api/webhooks/resend",
    req: req as NextRequest,
    requestId: svix_id,
  });

  return await requestContext.run(store, async () => {
    let delivery: null | { id: string } = null;

    try {
      delivery = await prisma.webhookDelivery.create({
        data: {
          deliveryId: svix_id,
          event: evt.type,
          provider: "resend",
          status: "PROCESSING",
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const existing = await prisma.webhookDelivery.findUnique({
          where: { provider_deliveryId: { deliveryId: svix_id, provider: "resend" } },
        });

        if (existing?.status === "SUCCESS") {
          return NextResponse.json({ msg: "Already processed", ok: true });
        }

        if (existing?.status === "FAILED") {
          // Update the failed record back to PROCESSING and continue processing
          delivery = await prisma.webhookDelivery.update({
            data: { status: "PROCESSING" },
            select: { id: true },
            where: { id: existing.id },
          });
        } else if (existing?.status === "PROCESSING") {
          // Already being processed, return early
          return new NextResponse("Processing in progress", { status: 202 });
        }
      } else {
        return new NextResponse("DB Error", { status: 500 });
      }
    }

    const { data, type } = evt;

    const reasonMap: Record<string, BannedEmailReason> = {
      "email.bounced": BannedEmailReason.BOUNCED,
      "email.complained": BannedEmailReason.COMPLAINED,
      "email.failed": BannedEmailReason.FAILED,
      "email.suppressed": BannedEmailReason.SUPPRESSED,
    };

    const reason = reasonMap[type];

    if (reason != null) {
      const rawEmail = data.to[0];
      if (rawEmail == null) return NextResponse.json({ ok: true });

      const email = normalizeEmail(rawEmail);

      try {
        await prisma.$transaction([
          prisma.bannedEmail.upsert({
            create: { email, emailHash: "", reason }, // NOTE: emailHash заполняется автоматически расширением prisma-field-encryption. Передаем пустую строку, чтобы удовлетворить строгие типы Prisma в методе upsert.
            update: { reason },
            where: { email },
          }),
          prisma.webhookDelivery.update({
            data: { status: "SUCCESS" },
            where: { id: delivery!.id },
          }),
        ]);

        logger.warn({ email, msg: "User blacklisted and delivery marked success", reason, type });
      } catch (error) {
        logger.error({ email, error, msg: "Failed to process transaction" });

        await prisma.webhookDelivery.update({
          data: {
            error: error instanceof Error ? error.message : String(error),
            status: "FAILED",
          },
          where: { id: delivery!.id },
        });

        return new NextResponse("Internal Error", { status: 500 });
      }
    } else {
      await prisma.webhookDelivery.update({
        data: { status: "SUCCESS" },
        where: { id: delivery!.id },
      });
    }

    return NextResponse.json({ ok: true });
  });
}
