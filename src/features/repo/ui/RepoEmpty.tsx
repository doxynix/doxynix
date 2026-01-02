import { CircleOff } from "lucide-react";

import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/shared/ui/empty";
import { CreateRepoEmptyButton } from "@/features/repo";

export function RepoEmpty() {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <CircleOff />
        </EmptyMedia>
        <EmptyTitle>Нет репозиториев</EmptyTitle>
        <EmptyDescription>Добавьте свой первый проект для анализа</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <CreateRepoEmptyButton />
      </EmptyContent>
    </Empty>
  );
}
