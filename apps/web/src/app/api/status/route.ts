import { NextResponse } from "next/server";

import { BETTERSTACK_TOKEN } from "@/shared/config/env.server";

import { withApiHandler } from "@/server/utils/with-api-handler";

type Monitor = {
  attributes: {
    paused: boolean;
    status: "down" | "maintenance" | "paused" | "pending" | "up";
  };
  id: string;
};

type MonitorListResponse = {
  data: Monitor[];
};

/**
 * Deliberately answers `200 {"status":"unknown"}` on failure rather than a 5xx:
 * this feeds a public status widget, and a failing upstream must not read as
 * "our service is down". The wrapper logs the reason, which the previous
 * `console.error` outside the request context never managed to correlate.
 */
async function handler() {
  const res = await fetch("https://uptime.betterstack.com/api/v2/monitors", {
    headers: {
      Authorization: `Bearer ${BETTERSTACK_TOKEN}`,
    },
    next: { revalidate: 60 },
  });

  if (!res.ok) {
    return NextResponse.json({ status: "unknown" });
  }

  const json: MonitorListResponse = await res.json();
  const monitors = json.data;

  let status = "up";
  if (monitors.some((m) => m.attributes.status === "down")) {
    status = "down";
  } else if (monitors.some((m) => m.attributes.status === "maintenance")) {
    status = "maintenance";
  }

  return NextResponse.json({ status });
}

export const GET = withApiHandler(handler, { scope: "status" });
