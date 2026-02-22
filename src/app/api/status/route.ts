import { NextResponse } from "next/server";

import { BETTERSTACK_TOKEN } from "@/shared/constants/env.server";
import { logger } from "@/shared/lib/logger";

export const runtime = "edge";

type Monitor = {
  id: string;
  attributes: {
    status: "up" | "down" | "paused" | "pending" | "maintenance";
    paused: boolean;
  };
};

type MonitorListResponse = {
  data: Monitor[];
};

export async function GET() {
  try {
    const res = await fetch("https://uptime.betterstack.com/api/v2/monitors", {
      headers: {
        Authorization: `Bearer ${BETTERSTACK_TOKEN}`,
      },
      next: { revalidate: 60 },
    });

    if (!res.ok) {
      return NextResponse.json({ status: "unknown" }, { status: 200 });
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
  } catch (error) {
    logger.error({ msg: "Status check failed:", error });
    return NextResponse.json({ status: "unknown" }, { status: 200 });
  }
}
