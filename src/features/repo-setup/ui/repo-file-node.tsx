import React from "react";
import {
  ChevronDown,
  ChevronRight,
  Folder,
  FolderOpen,
  File as LucideFile,
  Sparkles,
} from "lucide-react";
import type { NodeRendererProps } from "react-arborist";

import { cn } from "@/shared/lib/cn";
import { Badge } from "@/shared/ui/core/badge";
import { Button } from "@/shared/ui/core/button";
import { Checkbox } from "@/shared/ui/core/checkbox";

import { getFolderSelectionState, type FileNode } from "@/entities/repo-setup";

type RepoFileNodeProps = NodeRendererProps<FileNode> & {
  mySelectedIds: Set<string>;
  onMyToggle: (id: string, data: FileNode) => void;
};

export function RepoFileNode({ mySelectedIds, node, onMyToggle, style }: RepoFileNodeProps) {
  const isFolder = !node.isLeaf;
  const isRecommended = node.data.recommended;
  const isSelected = mySelectedIds.has(node.id);

  const selectionState = getFolderSelectionState(node.data, mySelectedIds);

  return (
    <div
      className={cn(
        "hover:text-foreground text-muted-foreground hover:bg-surface-hover flex w-full cursor-pointer items-center rounded-xl font-medium transition-colors",
        isSelected && "bg-surface-selected hover:bg-surface-selected text-foreground"
      )}
      style={style}
    >
      <div className="flex pl-2">
        <div className="flex size-4 shrink-0 items-center justify-center">
          {isFolder && (
            <Button
              type="button"
              tabIndex={-1}
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                node.toggle();
              }}
              className="bg-transparent hover:bg-transparent"
            >
              {node.isOpen ? (
                <ChevronDown className="size-3.5" />
              ) : (
                <ChevronRight className="size-3.5" />
              )}
              <span className="sr-only">Toggle folder {node.data.name}</span>
            </Button>
          )}
        </div>

        <div onPointerDown={(e) => e.stopPropagation()} className="flex items-center px-1">
          <Checkbox
            checked={selectionState}
            tabIndex={-1}
            aria-label={`Select ${node.data.name}`}
            onCheckedChange={() => onMyToggle(node.id, node.data)}
          />
        </div>
      </div>

      <div className="flex h-7 grow items-center gap-2 overflow-hidden pr-2">
        <div className="flex size-4 shrink-0 items-center justify-center">
          {isFolder ? (
            node.isOpen ? (
              <FolderOpen className="size-4" />
            ) : (
              <Folder className="size-4 fill-current" />
            )
          ) : (
            <LucideFile className={cn("size-4", isSelected && "font-bold")} />
          )}
        </div>

        <span className="truncate text-sm">{node.data.name}</span>

        {isRecommended === true && (
          <Badge variant="outline" className="ml-auto shrink-0">
            <Sparkles className="size-2.5" />
            Core
          </Badge>
        )}
      </div>
    </div>
  );
}
