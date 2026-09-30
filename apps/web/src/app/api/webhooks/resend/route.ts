import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { BannedEmailReason } from "@doxynix/shared";
import { Prisma } from "@prisma/client";
import { Webhook } from "svix";
import * as z from "zod";

import { RESEND_WEBHOOK_SECRET } from "@/shared/config/env.server";

import { AppError } from "@/server/core/api-error";
import { appLogger } from "@/server/core/app-logger";
import { prisma } from "@/server/core/db";
import { maskEmail, normalizeEmail } from "@/server/utils/email-guard";
import { getNormalizedHash } from "@/server/utils/hash";
import { buildRequestStore, requestContext } from "@/server/utils/request-context";
import { withApiHandler } from "@/server/utils/with-api-handler";

const resendWebhookSchema = z
  .object({
    created_at: z.string(),
    data: z.looseObject({
      bounce: z
        .looseObject({
          message: z.string(),
          subType: z.string(),
          type: z.string(),
        })
        .optional(),
      email_id: z.string(),
      failed: z
        .looseObject({
          reason: z.string(),
        })
        .optional(),
      from: z.string().optional(),
      subject: z.string().optional(),
      suppressed: z
        .looseObject({
          message: z.string(),
          reason: z.string().optional(),
          type: z.string(),
        })
        .optional(),
      to: z.array(z.string()),
    }),
    type: z.string(),
  })
  .loose();

async function handler(req: Request) {
  const payload = await req.text();
  const headerPayload = await headers();

  const svix_id = headerPayload.get("svix-id");
  const svix_timestamp = headerPayload.get("svix-timestamp");
  const svix_signature = headerPayload.get("svix-signature");

  if (svix_id == null || svix_timestamp == null || svix_signature == null) {
    throw new AppError({ code: "BAD_REQUEST", publicMessage: "Missing svix headers" });
  }

  const wh = new Webhook(RESEND_WEBHOOK_SECRET);
  let rawEvt: unknown;

  try {
    rawEvt = wh.verify(payload, {
      "svix-id": svix_id,
      "svix-signature": svix_signature,
      "svix-timestamp": svix_timestamp,
    });
  } catch {
    throw new AppError({ code: "BAD_REQUEST", publicMessage: "Verify failed" });
  }

  const parseResult = resendWebhookSchema.safeParse(rawEvt);
  if (!parseResult.success) {
    appLogger.error({ error: parseResult.error.issues, msg: "Invalid Resend webhook schema" });
    throw new AppError({ code: "BAD_REQUEST", publicMessage: "Invalid payload structure" });
  }
  const evt = parseResult.data;

  const store = buildRequestStore({
    method: "webhook",
    path: "/api/webhooks/resend",
    req,
    requestId: svix_id,
  });

  return requestContext.run(store, async () => {
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
          delivery = await prisma.webhookDelivery.update({
            data: { error: null, status: "PROCESSING" },
            select: { id: true },
            where: { id: existing.id },
          });
        } else if (existing?.status === "PROCESSING") {
          return NextResponse.json(
            { error: { code: "CONFLICT", message: "Processing in progress", requestId: svix_id } },
            { status: 202 },
          );
        }
      } else {
        throw new AppError({
          cause: error,
          code: "INTERNAL_SERVER_ERROR",
          publicMessage: "DB Error",
          unexpected: true,
        });
      }
    }

    if (delivery == null) {
      throw new AppError({
        code: "INTERNAL_SERVER_ERROR",
        publicMessage: "Internal Error: Delivery not initialized",
        unexpected: true,
      });
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
      if (rawEmail == null) {
        await prisma.webhookDelivery.update({
          data: {
            error: "Webhook payload missing recipient email",
            status: "FAILED",
          },
          where: { id: delivery.id },
        });

        throw new AppError({ code: "BAD_REQUEST", publicMessage: "Invalid payload" });
      }

      const email = normalizeEmail(rawEmail);

      try {
        await prisma.$transaction([
          prisma.bannedEmail.upsert({
            create: { email, reason },
            update: { reason },
            where: { emailHash: getNormalizedHash(email) },
          }),
          prisma.webhookDelivery.update({
            data: { error: null, status: "SUCCESS" },
            where: { id: delivery.id },
          }),
        ]);

        appLogger.warn({
          email: maskEmail(email),
          msg: "User blacklisted and delivery marked success",
          reason,
          type,
        });
      } catch (error) {
        appLogger.error({ email: maskEmail(email), error, msg: "Failed to process transaction" });

        await prisma.webhookDelivery.update({
          data: {
            error: error instanceof Error ? error.message : String(error),
            status: "FAILED",
          },
          where: { id: delivery.id },
        });

        throw new AppError({
          cause: error,
          code: "INTERNAL_SERVER_ERROR",
          publicMessage: "Internal Error",
          unexpected: true,
        });
      }
    } else {
      await prisma.webhookDelivery.update({
        data: { error: null, status: "SUCCESS" },
        where: { id: delivery.id },
      });
    }

    return NextResponse.json({ ok: true });
  });
}

// Reuses the delivery-scoped store above, so the requestId in an error body is the svix-id and matches the log lines.
export const POST = withApiHandler(handler, { scope: "webhooks/resend" });
