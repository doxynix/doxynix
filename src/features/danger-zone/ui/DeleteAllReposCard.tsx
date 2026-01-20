import { Card, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";

import { api } from "@/server/trpc/server";
import { DeleteAllReposDialog } from "./DeleteAllReposDialog";

export async function DeleteAllReposCard() {
  const limit = 1;
  const page = 1;

  const { meta } = await (
    await api()
  ).repo.getAll({
    cursor: page,
    limit,
  });

  return (
    <Card className="border-destructive">
      <CardHeader>
        <CardTitle>Delete All Repositories</CardTitle>
        <CardDescription className="muted-foreground mb-4 flex flex-col">
          <span>Permanently delete all repositories and associated data.</span>
          <span>Your GitHub source codes will not be affected.</span>
        </CardDescription>
        <DeleteAllReposDialog meta={meta} />
      </CardHeader>
    </Card>
  );
}
