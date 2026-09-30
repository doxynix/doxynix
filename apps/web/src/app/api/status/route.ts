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

// Failure answers 200 {"status":"unknown"} on purpose: this feeds a public widget, so a broken upstream must not read as "our service is down".
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
