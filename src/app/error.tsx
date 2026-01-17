"use client";

import React, { useState } from "react";
import { ServerCrash } from "lucide-react";

import BackOrLinkButton from "@/shared/ui/BackOrLinkButton";
import { Button } from "@/shared/ui/button";
import { CopyButton } from "@/shared/ui/CopyButton";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [requestId, setRequestId] = useState<string>("");

  React.useEffect(() => {
    const getCookie = (name: string) => {
      if (typeof document === "undefined") return;
      const value = document.cookie.match("(^|;)\\s*" + name + "\\s*=\\s*([^;]+)");
      return value ? value.pop() : null;
    };

    const rid = getCookie("last_request_id");
    if (rid !== null && rid !== undefined) {
      setRequestId(rid);
    }
  }, [error]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4">
      <div className="bg-destructive/10 text-destructive flex size-20 items-center justify-center rounded-full">
        <ServerCrash className="animate-pulse" size={35} />
      </div>

      <div className="w-full max-w-md space-y-4 text-center">
        <h1 className="text-3xl font-bold tracking-tight">Ошибка сервера</h1>
        <p className="text-muted-foreground text-base">
          Произошло что-то непредвиденное. Мы уже получили уведомление об ошибке и разбираемся.
        </p>
        <p className="text-muted-foreground text-left text-xs font-semibold tracking-wider uppercase">
          Идентификатор запроса
        </p>
        <div className="bg-muted/50 border-border space-y-3 rounded-xl border p-2 text-left">
          <div className="group flex items-center justify-between">
            <code className="text-xs break-all">
              {requestId ?? error.digest ?? "Системный сбой"}
            </code>
            <CopyButton
              tooltipText="Скопировать ID запроса"
              className="opacity-100"
              value={requestId ?? error.digest ?? ""}
            />
          </div>

          {process.env.NODE_ENV === "development" && (
            <div className="border-border/50 border-t pt-2">
              <p className="text-destructive/70 text-[10px] font-semibold uppercase">
                Debug Error:
              </p>
              <p className="text-destructive truncate font-mono text-xs">{error.message}</p>
            </div>
          )}
        </div>

        <div className="flex flex-col items-center justify-center gap-3 pt-4 sm:flex-row">
          <Button onClick={reset} className="cursor-pointer">
            Попробовать снова
          </Button>
          <BackOrLinkButton text="Вернуться назад" />
        </div>
      </div>

      <footer className="mt-12 text-sm">
        Нужна помощь?{" "}
        <a href="mailto:support@doxynix.space" className="underline hover:no-underline">
          support@doxynix.space
        </a>
      </footer>
    </div>
  );
}
