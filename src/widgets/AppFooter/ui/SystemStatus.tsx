"use client";

import { trpc } from "@/shared/api/trpc";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";

export function SystemStatus() {
  const { data, isError, isLoading } = trpc.health.check.useQuery(undefined, {
    staleTime: 60000,
    refetchInterval: 60000,
    retry: false,
  });

  const isHealthy = data?.status === "ok";
  const hasIssue = isError || (data && data.status !== "ok") || false;

  return (
    <div className="text-muted-foreground flex items-center gap-2 text-xs font-medium">
      <Button variant="outline" asChild size="sm">
        <a
          href="https://status.doxynix.space"
          rel="noopener noreferrer"
          target="_blank"
          className={cn(hasIssue && "text-error")}
        >
          <span className="relative flex h-2 w-2">
            {(isHealthy || hasIssue) && (
              <span
                className={cn(
                  "absolute inline-flex h-full w-full animate-ping rounded-full opacity-75",
                  isHealthy && "bg-success",
                  hasIssue && "bg-error"
                )}
              />
            )}

            <span
              className={cn(
                "relative inline-flex h-2 w-2 rounded-full",
                isLoading && "bg-gray-400",
                isHealthy && "bg-success",
                hasIssue && "bg-error"
              )}
            />
          </span>
          {isLoading ? "Checking..." : hasIssue ? "System Outage" : "All Systems Operational"}
        </a>
      </Button>
    </div>
  );
}
