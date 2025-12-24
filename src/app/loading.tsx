export default function Loading() {
  return (
    <div className="bg-background text-foreground flex min-h-screen items-center justify-center transition-colors duration-300">
      <div className="flex flex-col items-center gap-4">
        <div className="border-t-accent h-16 w-16 animate-spin rounded-full border-4 border-gray-200"></div>
        <span className="text-lg font-medium">Загрузка...</span>
      </div>
    </div>
  );
}
