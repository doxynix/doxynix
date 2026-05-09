"use client";

import { useEffect, useRef } from "react";
import { Terminal as TerminalIcon } from "lucide-react";

type Props = { logs: string[] };

export function AnalysisTerminal({ logs }: Readonly<Props>) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="w-full overflow-hidden rounded-lg border bg-black shadow-2xl">
      <div className="flex items-center gap-2 border-b border-zinc-800 bg-zinc-900 px-4 py-2">
        <TerminalIcon className="size-4 text-zinc-400" />
        <span className="text-[10px] font-bold tracking-widest text-zinc-400 uppercase">
          Engine Output
        </span>
      </div>
      <div
        ref={scrollRef}
        className="h-80 overflow-y-auto scroll-smooth p-4 font-mono text-xs leading-relaxed"
      >
        {logs.length === 0 && (
          <div className="animate-pulse text-zinc-600">Initializing analysis engine...</div>
        )}
        {logs.map((log, i) => (
          <div key={i} className="flex gap-3 border-b border-white/5 py-1 last:border-0">
            <span className="shrink-0 text-zinc-600 select-none">[{i + 1}]</span>
            <span className="text-zinc-300">{log}</span>
          </div>
        ))}
        <div className="bg-primary/10 mt-2 h-2 w-full animate-pulse" />
      </div>
    </div>
  );
}
