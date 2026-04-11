import { FileIcon, FileText, GitCommit, Layers } from "lucide-react";

import type { InteractiveBrief } from "@/shared/api/trpc";
import { Badge } from "@/shared/ui/core/badge";
import { Button } from "@/shared/ui/core/button";
import { CopyButton } from "@/shared/ui/kit/copy-button";

type Props = {
  brief: NonNullable<InteractiveBrief>;
  onNavigate: (id: string | null) => void;
};

export function RepoMapOverview({ brief, onNavigate }: Readonly<Props>) {
  return (
    <div className="flex flex-col gap-4 overflow-y-auto p-6">
      <h3 className="text-2xl">Project Brain</h3>
      <div className="flex items-center gap-2">
        {brief.analysisRef?.commitSha != null && (
          <Badge variant="outline" className="gap-1 font-mono text-xs">
            <GitCommit className="size-4" />
            {brief.analysisRef.commitSha.slice(0, 7)}
            <CopyButton
              value={brief.analysisRef.commitSha}
              tooltipSide="bottom"
              tooltipText="Copy SHA"
              className="opacity-100"
            />
          </Badge>
        )}
        <Badge variant="outline">{brief.overview.repositoryKind}</Badge>
      </div>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2 rounded-xl border p-4">
          <div className="flex items-center gap-1 text-xs">
            <Layers className="size-4" /> Architecture Style
          </div>
          {brief.overview.architectureStyle != null && (
            <p className="text-sm">{brief.overview.architectureStyle || "Standard / Layered"}</p>
          )}
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 text-xs">
            <FileText className="size-4" /> Stack
          </div>
          <div className="flex flex-wrap gap-2">
            {brief.overview.stack.map((path) => (
              <div key={path} className="text-muted-foreground p-2 text-xs">
                <span className="truncate">{path.split("/").pop()}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-xs">
            <FileText className="size-4" /> Primary modules
          </div>
          <div className="gap-2">
            {brief.overview.primaryModules.map((path) => (
              <Button
                key={path}
                variant="ghost"
                onClick={() => onNavigate(path)}
                className="p-2 text-xs"
              >
                <FileIcon className="size-4" />
                <span className="truncate">{path.split("/").pop()}</span>
              </Button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <div className="text-xs">Purpose</div>
          <div className="text-muted-foreground rounded-xl border p-4 text-xs italic">
            &quot;{brief.overview.purpose}&quot;
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 text-xs">
            <FileText className="size-4" /> Resources
          </div>
          <div className="flex flex-wrap gap-2">
            {brief.overview.primaryEntrypoints.map((path) => (
              <Button
                key={path}
                variant="ghost"
                onClick={() => onNavigate(path)}
                className="p-2 text-xs"
              >
                <FileIcon className="size-4" />
                <span className="truncate">{path.split("/").pop()}</span>
              </Button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
