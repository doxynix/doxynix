"use client";

import { AlertTriangle, Check, X } from "lucide-react";

import { AppBadge } from "@/shared/ui/core/badge";
import { AppButton } from "@/shared/ui/core/button";
import { Spinner } from "@/shared/ui/core/spinner";

type Props = {
  addToolApprovalResponse: (options: { approved: boolean; id: string; reason?: string }) => void;
  part: any;
  toolLabels: Record<string, string>;
};

function getDynamicToolContext(toolName: string, args: any): null | string {
  if (args == null || typeof args !== "object") return null;

  switch (toolName) {
    case "getFileContent":
    case "quickFileAudit":
    case "documentFile":
    case "stageFile":
    case "unstageFile": {
      return args.path ?? args.filePath ?? null;
    }
    case "readMultipleFiles": {
      return Array.isArray(args.paths) ? args.paths.join(", ") : null;
    }
    case "searchWorkspace":
    case "searchCode": {
      return args.search != null ? `"${args.search}"` : null;
    }
    case "getBranches":
    case "getRepoFiles": {
      return args.name != null ? `${args.owner}/${args.name}` : null;
    }
    case "openPullRequest":
    case "applyFix": {
      return args.title ?? null;
    }
    default: {
      return null;
    }
  }
}

export function ToolCallIndicator({ addToolApprovalResponse, part, toolLabels }: Readonly<Props>) {
  const toolName = part.type.slice(5);
  const baseLabel =
    toolLabels[toolName] ?? `Executing ${toolName.replaceAll(/([A-Z])/g, " $1").trim()}`;

  const dynamicContext = getDynamicToolContext(toolName, part.args);
  const fullLabel = dynamicContext != null ? `${baseLabel}: ${dynamicContext}` : baseLabel;

  const isApprovalRequested = part.state === "approval-requested";
  const isResponded = part.state === "approval-responded";
  const isCompleted = part.state === "output-available" || part.state === "output-error";

  if (isApprovalRequested) {
    return (
      <div className="animate-in fade-in my-2 w-full text-left duration-200">
        <div className="border-warning/30 bg-warning/5 flex max-w-[95%] flex-col gap-2 rounded-xl border p-3">
          <div className="text-warning flex items-center gap-1.5 text-xs font-semibold">
            <AlertTriangle className="size-3.5" />
            <span>Action Requires Confirmation</span>
          </div>
          <p className="text-muted-foreground text-xs leading-normal">
            The agent is requesting approval to:{" "}
            <strong className="text-foreground">{baseLabel}</strong>.
          </p>
          {part.args != null && (
            <pre className="bg-background text-muted-foreground no-scrollbar max-h-24 overflow-x-auto rounded-lg border p-2 font-mono text-[10px]">
              {JSON.stringify(part.args, null, 2)}
            </pre>
          )}
          <div className="mt-1 flex items-center gap-2">
            <AppButton
              size="sm"
              onClick={() => addToolApprovalResponse({ approved: true, id: part.approval.id })}
              className="bg-warning hover:bg-warning/90 text-xs"
            >
              Approve
            </AppButton>
            <AppButton
              size="sm"
              variant="ghost"
              onClick={() =>
                addToolApprovalResponse({
                  approved: false,
                  id: part.approval.id,
                  reason: "Denied by user",
                })
              }
              className="text-xs"
            >
              Deny
            </AppButton>
          </div>
        </div>
      </div>
    );
  }

  if (isResponded) {
    const wasApproved = part.approval?.approved;
    return (
      <div className="animate-in fade-in my-1 w-full text-left duration-200">
        <AppBadge
          variant="outline"
          className="text-muted-foreground flex items-center gap-2 text-xs"
        >
          {wasApproved === true ? (
            <>
              <span className="text-success text-xs font-bold">✓</span>
              <span className="text-foreground max-w-[320px] truncate">{fullLabel} (Approved)</span>
            </>
          ) : (
            <>
              <span className="text-destructive text-xs font-bold">✗</span>
              <span className="text-foreground max-w-[320px] truncate">{fullLabel} (Denied)</span>
            </>
          )}
        </AppBadge>
      </div>
    );
  }

  if (isCompleted) {
    const isError = part.state === "output-error";
    return (
      <div className="animate-in fade-in my-1 w-full text-left duration-200">
        <AppBadge
          variant="outline"
          className="text-muted-foreground flex items-center gap-2 text-xs"
        >
          {isError ? <X className="text-destructive" /> : <Check className="text-success" />}
          <span className="text-foreground max-w-[320px] truncate">
            {fullLabel} {isError ? "(Failed)" : "(Completed)"}
          </span>
        </AppBadge>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in my-1 w-full text-left duration-200">
      <AppBadge variant="outline" className="text-muted-foreground flex items-center gap-2 text-xs">
        <Spinner />
        <span className="text-foreground max-w-[320px] truncate">{fullLabel}</span>
      </AppBadge>
    </div>
  );
}
