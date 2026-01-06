"use client";

import { useEffect } from "react";
import { ServerCrash } from "lucide-react";

import BackOrLinkButton from "@/shared/ui/BackOrLinkButton";
import { Button } from "@/shared/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
      <div className="bg-destructive/10 text-destructive flex size-20 items-center justify-center rounded-full">
        <ServerCrash className="animate-pulse" size={35} />
      </div>

      <div className="flex flex-col gap-2">
        <h1 className="text-4xl font-bold">500 — Ошибка сервера</h1>
        <p className="text-muted-foreground text-lg">
          Произошла критическая ошибка при обработке запроса.
        </p>
        <span className="bg-muted mx-auto mt-2 inline-block w-fit rounded p-2 font-mono text-xs">
          Код ошибки: {error?.digest ?? "Unknown error"}
        </span>
        {process.env.NODE_ENV !== "development" && (
          <span className="bg-muted mx-auto mt-2 inline-block w-fit rounded p-2 font-mono text-xs">
            Error: {error.message}
          </span>
        )}
      </div>

      <div className="flex items-center gap-4">
        <Button onClick={reset} variant="default" className="cursor-pointer">
          Попробовать снова
        </Button>

        <BackOrLinkButton text="На главную" />
      </div>
      <p className="text-muted-foreground mt-4 text-sm">
        Если ошибка не исчезает, обратитесь по адресу:{" "}
        <a href="mailto:support@doxynix.space" className="text-text hover:underline">
          support@doxynix.space
        </a>
      </p>
    </div>
  );
}
