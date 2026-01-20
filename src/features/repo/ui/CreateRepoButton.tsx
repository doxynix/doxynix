"use client";

import { Plus } from "lucide-react";

import { Button } from "@/shared/ui/button";

import { useCreateRepoDialogStore } from "../model/create-repo-dialog.store";

export function CreateRepoButton() {
  const openDialog = useCreateRepoDialogStore((s) => s.openDialog);

  return (
    <Button className="cursor-pointer" variant="outline" onClick={openDialog}>
      <Plus /> Add Repository
    </Button>
  );
}
