"use client";

import { CircleOff } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/shared/ui/core/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/shared/ui/core/empty";

import { useCreateRepoDialogStore } from "../model/create-repo-dialog.store";

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
        <Button className="cursor-pointer" onClick={openDialog}>
          {tCommon("add")}
        </Button>
      </EmptyContent>
    </Empty>
  );
}
