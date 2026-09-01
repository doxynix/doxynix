import { ChevronDown, ChevronRight, FileIcon, Folder, FolderOpen, Sparkles } from "lucide-react";
import type { NodeRendererProps } from "react-arborist";

import { cn } from "@/shared/lib/cn";
import { AppBadge } from "@/shared/ui/core/badge";
import { AppButton } from "@/shared/ui/core/button";
import { Checkbox } from "@/shared/ui/core/checkbox";

import type { FileNode } from "@/entities/repo/model/repo-setup.types";
import { getFolderSelectionState } from "@/entities/repo/model/repo-setup-utils";

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
        "flex w-full cursor-pointer items-center rounded-xl font-medium text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground",
        isSelected && "bg-surface-selected text-foreground hover:bg-surface-selected",
      )}
      style={style}
    >
      <div className="flex pl-2">
        <div className="flex size-4 shrink-0 items-center justify-center">
          {isFolder && (
            <AppButton
              className="bg-transparent hover:bg-transparent"
              onClick={(e) => {
                e.stopPropagation();
                node.toggle();
              }}
              tabIndex={-1}
              type="button"
              variant="ghost"
            >
              {node.isOpen ? (
                <ChevronDown className="size-3.5" />
              ) : (
                <ChevronRight className="size-3.5" />
              )}
              <span className="sr-only">Toggle folder {node.data.name}</span>
            </AppButton>
          )}
        </div>

        <div className="flex items-center px-1" onPointerDown={(e) => e.stopPropagation()}>
          <Checkbox
            aria-label={`Select ${node.data.name}`}
            checked={selectionState}
            onCheckedChange={() => onMyToggle(node.id, node.data)}
            tabIndex={-1}
          />
        </div>
      </div>

      <div className="flex h-7 grow items-center gap-2 overflow-hidden pr-2">
        <div className="flex size-4 shrink-0 items-center justify-center">
          {isFolder ? (
            node.isOpen ? (
              <FolderOpen />
            ) : (
              <Folder className="fill-current" />
            )
          ) : (
            <FileIcon className={cn(isSelected && "font-bold")} />
          )}
        </div>

        <span className="truncate text-sm">{node.data.name}</span>

        {isRecommended === true && (
          <AppBadge className="ml-auto shrink-0" variant="outline">
            <Sparkles className="size-2.5" />
            Core
          </AppBadge>
        )}
      </div>
    </div>
  );
}
