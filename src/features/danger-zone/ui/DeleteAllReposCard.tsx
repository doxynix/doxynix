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
        <CardDescription className="mb-4">
          Полностью удалить все репозитории и связанные данные
        </CardDescription>
        <DeleteAllReposDialog meta={meta} />
      </CardHeader>
    </Card>
  );
}
