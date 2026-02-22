"use client";

import { CircleOff } from "lucide-react";
import { useTranslations } from "next-intl";

import { useCreateRepoDialogStore } from "@/shared/model/create-repo-dialog.store";
import { Button } from "@/shared/ui/core/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/shared/ui/core/empty";

export function RepoEmpty() {
  const openDialog = useCreateRepoDialogStore((s) => s.openDialog);
  const tCommon = useTranslations("Common");
  const t = useTranslations("Dashboard");
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
        <Button onClick={openDialog} className="cursor-pointer">
          {tCommon("add")}
        </Button>
      </EmptyContent>
    </Empty>
  );
}
