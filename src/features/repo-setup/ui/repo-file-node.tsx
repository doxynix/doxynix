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

  const handleSelect = () => {
    onMyToggle(node.id, node.data);
  };

  return (
    <div
      role="treeitem"
      tabIndex={0}
      aria-expanded={isFolder ? node.isOpen : undefined}
      aria-selected={isSelected}
      onClick={handleSelect}
      onKeyDown={(e) => {
        if (e.key === " " || e.key === "Enter") {
          e.preventDefault();
          onMyToggle(node.id, node.data);
        }
      }}
      className={cn(
        "hover:bg-surface-hover text-muted-foreground flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1 transition-colors outline-none",
        isSelected && "bg-surface-selected hover:bg-surface-selected text-foreground"
      )}
      style={style}
    >
      <div className="flex size-4 shrink-0 items-center justify-center">
        {isFolder && (
          <Button
            type="button"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              node.toggle();
            }}
            className="bg-transparent p-0 hover:bg-transparent"
          >
            {node.isOpen ? (
              <ChevronDown className="size-3.5" />
            ) : (
              <ChevronRight className="size-3.5" />
            )}
            <span className="sr-only">Toggle folder</span>
          </Button>
        )}
      </div>

      <div onClick={(e) => e.stopPropagation()} className="flex items-center px-1">
        <Checkbox
          checked={selectionState}
          tabIndex={-1}
          onCheckedChange={() => onMyToggle(node.id, node.data)}
        />
      </div>

      <div className="flex grow items-center gap-2 overflow-hidden">
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
          <Badge variant="outline" className="ml-auto">
            <Sparkles className="h-2.5 w-2.5" />
            Core
          </Badge>
        )}
      </div>
    </div>
  );
}
