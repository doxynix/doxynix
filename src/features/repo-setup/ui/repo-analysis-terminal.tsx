"use client";

import { useEffect, useRef } from "react";
import { Terminal as TerminalIcon } from "lucide-react";

import { cn } from "@/shared/lib/cn";
import { Skeleton } from "@/shared/ui/core/skeleton";

type Props = { logs: string[] };

export function AnalysisTerminal({ logs }: Readonly<Props>) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  const colors = {
    error: "text-error",
    info: "text-blue",
    success: "text-success",
    warn: "text-warning",
  };

  return (
    <div className="w-full overflow-hidden rounded-lg border bg-black shadow-2xl">
      <div className="flex items-center gap-2 border-b border-zinc-800 bg-zinc-900 px-4 py-2">
        <TerminalIcon />
        <span className="text-[10px] font-bold tracking-widest text-zinc-400 uppercase">
          Engine Output
        </span>
      </div>
      <div
        ref={scrollRef}
        className="h-80 overflow-y-auto scroll-smooth p-4 font-mono text-xs leading-relaxed"
      >
        {logs.length === 0 && <div className="animate-pulse">Initializing analysis engine...</div>}

        {logs.map((log, i) => {
          const [level, time, message] =
            typeof log === "string" && log.includes(":::") ? log.split(":::") : ["info", "", log];

          return (
            <div key={i} className="flex gap-3 border-b py-1 last:border-0">
              {time != null && <span className="shrink-0">[{time}]</span>}
              <span
                className={cn(colors[level as keyof typeof colors] || colors.info, "break-all")}
              >
                {message}
              </span>
            </div>
          );
        })}

        {logs.length > 0 && (
          <div className="flex flex-col items-center justify-center gap-1">
            <Skeleton className="h-1 w-full" />
            <Skeleton className="h-1 w-full" />
          </div>
        )}
      </div>
    </div>
  );
}
