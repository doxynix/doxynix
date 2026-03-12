import crypto from "node:crypto";
import { NextResponse } from "next/server";

import { GITHUB_WEBHOOK_SECRET } from "@/shared/constants/env.server";

import { prisma } from "@/server/db/db";

export async function POST(req: Request) {
  const payload = await req.text();
  const signature = req.headers.get("x-hub-signature-256") ?? "";

  const hmac = crypto.createHmac("sha256", GITHUB_WEBHOOK_SECRET);
  const digest = "sha256=" + hmac.update(payload).digest("hex");
  const signatureBuffer = Buffer.from(signature);
  const digestBuffer = Buffer.from(digest);

  if (
    signatureBuffer.length !== digestBuffer.length ||
    !crypto.timingSafeEqual(signatureBuffer, digestBuffer)
  ) {
    return new NextResponse("Invalid signature", { status: 401 });
  }

  const event = JSON.parse(payload);
  const action = event.action;

  if (Boolean(event.installation) && action === "deleted") {
    const installationId = event.installation.id;

    await prisma.account.updateMany({
      data: {
        githubInstallationId: null,
        githubInstallationUrl: null,
      },
      where: { githubInstallationId: installationId },
    });
  }

  return NextResponse.json({ ok: true });
}
