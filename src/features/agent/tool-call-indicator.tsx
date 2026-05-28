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

export function ToolCallIndicator({ addToolApprovalResponse, part, toolLabels }: Readonly<Props>) {
  const toolName = part.type.slice(5);
  const label =
    toolLabels[toolName] ?? `Executing ${toolName.replaceAll(/([A-Z])/g, " $1").trim()}`;

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
            <strong className="text-foreground">{label}</strong>.
          </p>
          {part.args != null && (
            <pre className="bg-background/50 text-muted-foreground max-h-24 overflow-x-auto rounded-lg p-2 font-mono text-[10px]">
              {JSON.stringify(part.args, null, 2)}
            </pre>
          )}
          <div className="mt-1 flex items-center gap-2">
            <AppButton
              size="sm"
              onClick={() => addToolApprovalResponse({ approved: true, id: part.approval.id })}
              className="bg-warning text-warning-foreground hover:bg-warning/90 text-xs"
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
              <span className="text-foreground">{label} (Approved)</span>
            </>
          ) : (
            <>
              <span className="text-destructive text-xs font-bold">✗</span>
              <span className="text-foreground">{label} (Denied)</span>
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
          <span className="text-foreground">
            {label} {isError ? "(Failed)" : "(Completed)"}
          </span>
        </AppBadge>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in my-1 w-full text-left duration-200">
      <AppBadge variant="outline" className="text-muted-foreground flex items-center gap-2 text-xs">
        <Spinner />
        <span className="text-foreground">{label}</span>
      </AppBadge>
    </div>
  );
}
