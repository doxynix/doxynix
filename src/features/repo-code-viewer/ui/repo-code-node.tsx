import React from "react";
import { ChevronDown, ChevronRight, Folder, FolderOpen, File as LucideFile } from "lucide-react";
import type { NodeRendererProps } from "react-arborist";

import { cn } from "@/shared/lib/utils";

import type { FileNode } from "@/entities/repo-setup";

type RepoCodeNodeProps = NodeRendererProps<FileNode> & {
  activePath: string | null;
  onSelect: (path: string | null) => void;
};

export function RepoCodeNode({ activePath, node, onSelect, style }: RepoCodeNodeProps) {
  const isActive = activePath === node.id;
  const isFolder = !node.isLeaf;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isFolder) {
      node.toggle();
    } else {
      onSelect(node.id);
    }
  };

  return (
    <div
      onClick={handleClick}
      className={cn(
        "hover:bg-surface-hover text-muted-foreground flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1 transition-colors outline-none",
        isActive && "bg-surface-selected hover:bg-surface-selected text-foreground"
      )}
      style={style}
    >
      <div className="flex size-4 shrink-0 items-center justify-center">
        {isFolder &&
          (node.isOpen ? (
            <ChevronDown className="size-3.5" />
          ) : (
            <ChevronRight className="size-3.5" />
          ))}
      </div>
      <div className="flex size-4 shrink-0 items-center justify-center">
        {isFolder ? (
          node.isOpen ? (
            <FolderOpen className="size-4" />
          ) : (
            <Folder className="size-4 fill-current" />
          )
        ) : (
          <LucideFile className={cn("size-4", isActive && "font-bold")} />
        )}
      </div>
      <span className="truncate text-sm">{node.data.name}</span>
    </div>
  );
}
