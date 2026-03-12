import crypto from "node:crypto";
import { NextResponse } from "next/server";

import { GITHUB_WEBHOOK_SECRET } from "@/shared/constants/env.server";

import { prisma } from "@/server/db/db";

type GitHubWebhookEvent = {
  action?: string;
  installation?: {
    id?: number;
  };
};

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

  let event: GitHubWebhookEvent;
  try {
    event = JSON.parse(payload) as GitHubWebhookEvent;
  } catch {
    return new NextResponse("Invalid JSON", { status: 400 });
  }

  const action = event.action;
  const githubEvent = req.headers.get("x-github-event");

  if (githubEvent === "installation" && event.installation?.id != null && action === "deleted") {
    try {
      await prisma.account.updateMany({
        data: {
          githubInstallationId: null,
          githubInstallationUrl: null,
        },
        where: { githubInstallationId: BigInt(event.installation.id) },
      });
    } catch (error) {
      console.error("Webhook DB Error:", error);
      return new NextResponse("DB Error", { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}
