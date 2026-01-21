import { CircleOff } from "lucide-react";

import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/shared/ui/core/empty";

import { CreateRepoEmptyButton } from "./create-repo-empty-button";

export function RepoEmpty() {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <CircleOff />
        </EmptyMedia>
        <EmptyTitle>No repositories</EmptyTitle>
        <EmptyDescription>Add your first project for analysis</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <CreateRepoEmptyButton />
      </EmptyContent>
    </Empty>
  );
}
