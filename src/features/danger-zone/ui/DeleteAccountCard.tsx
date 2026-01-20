import { Card, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";

import { DeleteAccountDialog } from "./DeleteAccountDialog";

export function DeleteAccountCard() {
  return (
    <Card className="border-destructive">
      <CardHeader>
        <CardTitle>Delete Account</CardTitle>
        <CardDescription className="mb-4">
          Permanently delete account and all associated data{" "}
        </CardDescription>
        <DeleteAccountDialog />
      </CardHeader>
    </Card>
  );
}
