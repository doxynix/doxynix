"use client";

import { useState } from "react";
import { ChevronDown, History } from "lucide-react";

import { cn, formatRelativeTime } from "@/shared/lib/utils";
import { Badge } from "@/shared/ui/core/badge";
import { Button } from "@/shared/ui/core/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/shared/ui/core/collapsible";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui/core/table";

import { UiApiKey } from "@/entities/api-keys";

type Props = {
  archived: UiApiKey[];
};

export function ApiKeyArchivedTable({ archived }: Props) {
  const [isArchivedOpen, setIsArchivedOpen] = useState(false);

  return (
    <Collapsible
      open={isArchivedOpen}
      onOpenChange={setIsArchivedOpen}
      className="bg-card text-card-foreground rounded-lg border shadow-sm"
    >
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <History className="text-muted-foreground h-4 w-4" />
          <h3 className="text-sm font-medium">History (Revoked)</h3>
          <Badge className="ml-1 text-xs">{archived.length}</Badge>
        </div>

        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
            <ChevronDown
              className={cn(
                "-rotate-90 transition-transform duration-300",
                isArchivedOpen && "rotate-0"
              )}
            />
          </Button>
        </CollapsibleTrigger>
      </div>

      <CollapsibleContent>
        <div className="border-t">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Title</TableHead>
                <TableHead>Prefix</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Last used</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {archived.map((key) => (
                <TableRow key={key.id} className="opacity-70 hover:opacity-100">
                  <TableCell className="max-w-sm truncate font-medium">{key.name}</TableCell>
                  <TableCell className="text-muted-foreground font-mono text-xs">
                    {key.prefix ? `${key.prefix}...` : "..."}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {formatRelativeTime(key.createdAt)}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {formatRelativeTime(key.lastUsed)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
