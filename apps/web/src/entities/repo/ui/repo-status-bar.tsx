import { AlertCircle, FileEdit } from "lucide-react";

import { cn } from "@/shared/lib/cn";
import { formatSize } from "@/shared/lib/size-format";

import type { EditorStats } from "../model/editor-stats.types";
import type { FileMeta } from "../model/repo.types";

type Props = {
  meta: FileMeta;
  readOnly: boolean;
  stats: EditorStats;
};

export function RepoStatusBar({ meta, readOnly, stats }: Readonly<Props>) {
  return (
    <div className="flex items-center justify-between bg-card px-3 py-1.5 font-mono text-[11px]">
      <div className="flex items-center gap-3 font-semibold">
        <span
          className={cn(
            "rounded border p-px font-bold text-[10px] uppercase",
            readOnly
              ? "border-info/50 bg-info/10 text-info"
              : "border-success/50 bg-success/10 text-success",
          )}
        >
          {readOnly ? "View" : "Edit"}
        </span>
        <span>{meta.name}</span>
        {stats.isDirty && (
          <span className="flex animate-pulse items-center gap-1 text-warning">
            <FileEdit className="size-3" />
            Modified
          </span>
        )}
        {stats.errors > 0 && (
          <div className="flex items-center gap-1 font-bold text-destructive">
            <AlertCircle className="size-3" />
            {stats.errors}
          </div>
        )}
      </div>

      <div className="flex items-center gap-3 text-muted-foreground">
        <span>
          Ln {stats.line}, Col {stats.col}
        </span>
        <span>Lines: {stats.totalLines}</span>
        <span>{formatSize(meta.size)}</span>
      </div>
    </div>
  );
}
