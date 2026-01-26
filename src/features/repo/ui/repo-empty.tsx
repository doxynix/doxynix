import { CircleOff } from "lucide-react";
import { getTranslations } from "next-intl/server";

import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/shared/ui/core/empty";

import { CreateRepoEmptyButton } from "./create-repo-empty-button";

export async function RepoEmpty() {
  const t = await getTranslations("Dashboard");
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <CircleOff />
        </EmptyMedia>
        <EmptyTitle>{t("repo_empty_title")}</EmptyTitle>
        <EmptyDescription>{t("repo_empty_repos_desc")}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <CreateRepoEmptyButton />
      </EmptyContent>
    </Empty>
  );
}
