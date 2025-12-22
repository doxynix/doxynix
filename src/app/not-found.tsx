import BackButton from "@/shared/BackButton/ui";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center h-screen gap-4">
      <h1 className="text-4xl font-bold">404 — Страница не найдена</h1>
      <p className="text-lg text-muted-foreground">К сожалению, такой страницы не существует.</p>
      <BackButton />
    </div>
  );
}
