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
  down: {
    dotColor: "bg-error",
    hasPing: true,
    label: "System Outage",
    textColor: "text-error",
  },
  maintenance: {
    dotColor: "bg-warning",
    hasPing: false,
    label: "Maintenance",
    textColor: "text-warning",
  },
  unknown: {
    dotColor: "bg-muted-foreground",
    hasPing: false,
    label: "Status Unknown",
    textColor: "text-muted-foreground",
  },
  up: {
    dotColor: "bg-success",
    hasPing: true,
    label: "All Systems Operational",
    textColor: "text-muted-foreground",
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

export function SystemStatus({ className }: Readonly<{ className?: string }>) {
  const { data: status = "unknown", isLoading } = useQuery({
    queryFn: fetchSystemStatus,
    queryKey: ["system-status"],
    refetchInterval: REFETCH_INTERVAL,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    retry: false,
    staleTime: STALE_TIME,
  });

  const current = config[status];

  return (
    <div className={cn("flex items-center gap-2 text-xs font-medium", className)}>
      {isLoading ? (
        <Skeleton className="h-8 w-45" />
      ) : (
        <Button asChild size="sm" variant="outline" className="cursor-pointer">
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
