import React, { useMemo } from "react";
import {
  ChevronDown,
  ChevronRight,
  Folder,
  FolderOpen,
  File as LucideFile,
  Sparkles,
} from "lucide-react";
import type { NodeRendererProps } from "react-arborist";

import { cn } from "@/shared/lib/utils";
import type { FileNode } from "@/shared/types/repo";
import { Checkbox } from "@/shared/ui/core/checkbox";

import { getFolderSelectionState } from "../model/utils";

type RepoFileNodeProps = NodeRendererProps<FileNode> & {
  mySelectedIds: Set<string>;
  onMyToggle: (id: string, data: FileNode) => void;
};

export function RepoFileNode({ mySelectedIds, node, onMyToggle, style }: RepoFileNodeProps) {
  const isFolder = !node.isLeaf;
  const isRecommended = node.data.recommended;

  const selectionState = useMemo(() => {
    return getFolderSelectionState(node.data, mySelectedIds);
  }, [node.data, mySelectedIds]);

  const handleAction = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onMyToggle(node.id, node.data);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleAction}
      onKeyDown={(e) => {
        if (e.key === " " || e.key === "Enter") {
          handleAction(e);
        }
      }}
      className={cn(
        "flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1 transition-colors outline-none",
        "hover:bg-accent/50",
        mySelectedIds.has(node.id) && "bg-accent/30",
        node.isFocused && "ring-ring inset-0 ring-1"
      )}
      style={style}
    >
      <div className="flex items-center">
        <Checkbox
          checked={selectionState}
          onCheckedChange={() => onMyToggle(node.id, node.data)}
          onClick={(e) => e.stopPropagation()}
          className={cn("ml-1 h-4 w-4 transition-all")}
        />
      </div>

      <div className="flex h-4 w-4 shrink-0 items-center justify-center">
        {isFolder && (
          <div
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              node.toggle();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                e.stopPropagation();
                node.toggle();
              }
            }}
            className="hover:bg-muted rounded p-0.5 transition-colors"
          >
            {node.isOpen ? (
              <ChevronDown className="text-muted-foreground h-3 w-3" />
            ) : (
              <ChevronRight className="text-muted-foreground h-3 w-3" />
            )}
          </div>
        )}
      </div>

      <div className="flex h-4 w-4 shrink-0 items-center justify-center">
        {isFolder ? (
          node.isOpen ? (
            <FolderOpen className="text-muted-foreground h-4 w-4" />
          ) : (
            <Folder className="text-muted-foreground h-4 w-4 fill-current" />
          )
        ) : (
          <LucideFile className="text-muted-foreground h-4 w-4" />
        )}
      </div>

      <span
        className={cn(
          "text-muted-foreground grow truncate text-sm font-normal select-none",
          isRecommended === true && "text-foreground font-semibold"
        )}
      >
        {node.data.name}
      </span>

      {isRecommended === true && !isFolder && (
        <div className="flex items-center gap-1 rounded-md border px-1 py-0.5 text-[10px] font-bold uppercase">
          <Sparkles className="h-2.5 w-2.5" />
          Core
        </div>
      )}
    </div>
  );
}
