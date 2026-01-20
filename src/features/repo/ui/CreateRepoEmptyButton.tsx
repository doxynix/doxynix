"use client";

import { Button } from "@/shared/ui/button";

import { useCreateRepoDialogStore } from "../model/create-repo-dialog.store";

export function CreateRepoEmptyButton() {
  const openDialog = useCreateRepoDialogStore((s) => s.openDialog);

  return (
    <Button className="cursor-pointer" onClick={openDialog}>
      Add
    </Button>
  );
}
