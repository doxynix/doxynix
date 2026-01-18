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
        <CardTitle>Удалить все репозитории</CardTitle>
        <CardDescription className="muted-foreground mb-4 flex flex-col">
          <span>Полностью удалить все репозитории и связанные данные.</span>
          <span>Ваши исходные коды на GitHub затронуты не будут.</span>
        </CardDescription>
        <DeleteAllReposDialog meta={meta} />
      </CardHeader>
    </Card>
  );
}
