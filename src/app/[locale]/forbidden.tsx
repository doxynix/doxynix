import { Lock } from "lucide-react";

import { Button } from "@/shared/ui/core/button";
import { Link } from "@/i18n/routing";

export default function ForbiddenPage() {
  return (
    <div className="flex h-[70dvh] w-full flex-col items-center justify-center">
      <div className="flex max-w-md flex-col items-center space-y-6 text-center">
        <div className="bg-warning/10 text-warning flex size-20 items-center justify-center rounded-full">
          <Lock size={40} />
        </div>
        <h1 className="text-3xl font-bold tracking-tight">Доступ запрещен</h1>
        <p className="text-muted-foreground">
          У вас нет прав администратора для просмотра этой страницы. Если вы считаете, что это
          ошибка, обратитесь в поддержку. support@doxynix.space
        </p>
        <Button asChild variant="outline">
          <Link href="/">Вернуться на главную</Link>
        </Button>
      </div>
    </div>
  );
}
