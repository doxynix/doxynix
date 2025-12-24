import BackButton from "@/shared/ui/BackButton/ui";

export default function NotFound() {
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-4">
      <h1 className="text-4xl font-bold">404 — Страница не найдена</h1>
      <p className="text-muted-foreground text-lg">К сожалению, такой страницы не существует.</p>
      <BackButton />
    </div>
  );
}
