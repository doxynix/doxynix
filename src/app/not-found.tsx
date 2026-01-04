import { Metadata } from "next";

import BackOrLinkButton from "@/shared/ui/BackButton";

export const metadata: Metadata = {
  title: "404",
};

export default function NotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4">
      <h1 className="text-4xl font-bold">404 — Страница не найдена</h1>
      <p className="text-muted-foreground text-lg">К сожалению, такой страницы не существует.</p>
      <div className="flex gap-4">
        <BackOrLinkButton text="Назад" />
        <BackOrLinkButton text="На главную" href="/" />
      </div>
    </div>
  );
}
