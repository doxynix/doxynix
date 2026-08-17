import { Lock } from "lucide-react";

import { Link } from "@/shared/i18n/navigation";
import { AppButton } from "@/shared/ui/core/button";

export default function ForbiddenPage() {
  return (
    <div className="flex h-[70dvh] w-full flex-col items-center justify-center">
      <div className="flex max-w-md flex-col items-center gap-6 text-center">
        <div className="bg-warning/10 text-warning flex size-20 items-center justify-center rounded-full">
          <Lock size={40} />
        </div>
        <h1 className="text-3xl font-bold tracking-tight">Access Denied</h1>
        <p className="text-muted-foreground">
          You do not have administrator permissions to view this page. If you believe this is an
          error, please contact support at support@doxynix.space
        </p>
        <AppButton asChild variant="outline">
          <Link href="/">Back to Home</Link>
        </AppButton>
      </div>
    </div>
  );
}
