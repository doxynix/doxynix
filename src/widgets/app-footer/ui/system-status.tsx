"use client";

import { useQuery } from "@tanstack/react-query";

import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/core/button";
import { Skeleton } from "@/shared/ui/core/skeleton";

type StatusType = "up" | "down" | "maintenance" | "unknown";

type StatusResponse = {
  status: StatusType;
};

const config = {
  up: {
    label: "All Systems Operational",
    dotColor: "bg-success",
    textColor: "text-muted-foreground",
    hasPing: true,
  },
  down: {
    label: "System Outage",
    dotColor: "bg-error",
    textColor: "text-error",
    hasPing: true,
  },
  maintenance: {
    label: "Maintenance",
    dotColor: "bg-warning",
    textColor: "text-warning",
    hasPing: false,
  },
  unknown: {
    label: "Status Unknown",
    dotColor: "bg-muted-foreground",
    textColor: "text-muted-foreground",
    hasPing: false,
  },
};

const fetchSystemStatus = async (): Promise<StatusType> => {
  const res = await fetch("/api/status");
  if (!res.ok) throw new Error("Network error");
  const data = (await res.json()) as StatusResponse;
  return data.status;
};

const STALE_TIME = 4 * 60 * 1000; // TIME: 4 minutes
const REFETCH_INTERVAL = 5 * 60 * 1000; // TIME: 5 minutes

export function SystemStatus({ className }: { className?: string }) {
  const { data: status = "unknown", isLoading } = useQuery({
    queryKey: ["system-status"],
    queryFn: fetchSystemStatus,
    refetchInterval: REFETCH_INTERVAL,
    staleTime: STALE_TIME,
    refetchOnWindowFocus: true,
    refetchIntervalInBackground: false,
    retry: false,
  });

  const current = config[status] ?? config.unknown;

  return (
    <div className={cn("flex items-center gap-2 text-xs font-medium", className)}>
      {isLoading ? (
        <Skeleton className="h-8 w-45" />
      ) : (
        <Button variant="outline" size="sm" asChild className="cursor-pointer">
          <a
            href="https://status.doxynix.space"
            rel="noopener noreferrer"
            target="_blank"
            className={cn("flex items-center gap-2", current.textColor)}
          >
            <span className="relative flex size-2">
              {current.hasPing && (
                <span
                  className={cn(
                    "absolute inline-flex h-full w-full animate-ping rounded-full opacity-75",
                    current.dotColor
                  )}
                />
              )}
              <span className={cn("relative inline-flex size-2 rounded-full", current.dotColor)} />
            </span>

            {current.label}
          </a>
        </Button>
      )}
    </div>
  );
}
