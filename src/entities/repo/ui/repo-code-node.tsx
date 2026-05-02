import { type MouseEvent } from "react";
import { ChevronDown, ChevronRight, FileIcon, Folder, FolderOpen } from "lucide-react";
import type { NodeRendererProps } from "react-arborist";

import { cn } from "@/shared/lib/cn";
import { Button } from "@/shared/ui/core/button";

import type { FileNode } from "@/entities/repo/model/repo-setup.types";

type RepoCodeNodeProps = NodeRendererProps<FileNode> & {
  activePath: null | string;
  onSelect: (path: null | string) => void;
};

export function RepoCodeNode({ activePath, node, onSelect, style }: RepoCodeNodeProps) {
  const isActive = activePath === node.id;
  const isFolder = !node.isLeaf;

  const handleClick = (e: MouseEvent) => {
    e.stopPropagation();
    if (isFolder) {
      node.toggle();
    } else {
      onSelect(node.id);
    }
  };

  return (
    <Button
      variant="ghost"
      onClick={handleClick}
      className={cn(
        "hover:bg-surface-hover text-muted-foreground flex h-7 w-full cursor-pointer items-center justify-start rounded-xl transition-colors outline-none",
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
            <FolderOpen />
          ) : (
            <Folder className="fill-current" />
          )
        ) : (
          <FileIcon className={cn(isActive && "font-bold")} />
        )}
      </div>
      <span className="truncate text-sm">{node.data.name}</span>
    </Button>
  );
}
