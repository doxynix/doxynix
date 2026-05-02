"use client";

import { FileIcon, FileText, GitCommit, Layers } from "lucide-react";

import { Badge } from "@/shared/ui/core/badge";
import { Button } from "@/shared/ui/core/button";
import { CopyButton } from "@/shared/ui/kit/copy-button";

import type { RepoWorkspace } from "@/entities/repo/model/repo.types";

type Props = {
  onNavigate: (id: null | string) => void;
  workspace: NonNullable<RepoWorkspace>;
};

export function RepoMapOverview({ onNavigate, workspace }: Readonly<Props>) {
  return (
    <div className="flex flex-col gap-4 overflow-y-auto p-6">
      <h3 className="text-2xl">Project Brain</h3>
      <div className="flex items-center gap-2">
        {workspace.analysisRef?.commitSha != null && (
          <Badge variant="outline" className="gap-1 font-mono text-xs">
            <GitCommit />
            {workspace.analysisRef.commitSha.slice(0, 7)}
            <CopyButton
              value={workspace.analysisRef.commitSha}
              tooltipSide="bottom"
              tooltipText="Copy SHA"
              className="opacity-100"
            />
          </Badge>
        )}
        <Badge variant="outline">{workspace.summary.repositoryKind}</Badge>
      </div>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2 rounded-xl border p-4">
          <div className="flex items-center gap-1 text-xs">
            <Layers /> Architecture Style
          </div>
          {workspace.summary.architectureStyle != null && (
            <p className="text-sm">{workspace.summary.architectureStyle || "Standard / Layered"}</p>
          )}
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 text-xs">
            <FileText /> Stack
          </div>
          <div className="flex flex-wrap gap-2">
            {workspace.summary.stack.map((path) => (
              <div key={path} className="text-muted-foreground p-2 text-xs">
                <span className="truncate">{path.split("/").pop()}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-xs">
            <FileText /> Primary modules
          </div>
          <div className="gap-2">
            {workspace.navigation.primaryModules.map((path) => (
              <Button
                key={path}
                variant="ghost"
                onClick={() => onNavigate(path)}
                className="p-2 text-xs"
              >
                <FileIcon />
                <span className="truncate">{path.split("/").pop()}</span>
              </Button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <div className="text-xs">Purpose</div>
          <div className="text-muted-foreground rounded-xl border p-4 text-xs italic">
            &quot;{workspace.summary.purpose}&quot;
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 text-xs">
            <FileText /> Resources
          </div>
          <div className="flex flex-wrap gap-2">
            {workspace.navigation.primaryEntrypoints.map((path) => (
              <Button
                key={path}
                variant="ghost"
                onClick={() => onNavigate(path)}
                className="p-2 text-xs"
              >
                <FileIcon />
                <span className="truncate">{path.split("/").pop()}</span>
              </Button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
