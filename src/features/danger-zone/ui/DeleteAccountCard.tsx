import { Card, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";

import { DeleteAccountDialog } from "./DeleteAccountDialog";

export function DeleteAccountCard() {
  return (
    <Card className="border-destructive">
      <CardHeader>
        <CardTitle>Удалить аккаунт</CardTitle>
        <CardDescription className="mb-4">
          Полностью удалить аккаунт и все связанные данные
        </CardDescription>
        <DeleteAccountDialog />
      </CardHeader>
    </Card>
  );
}
