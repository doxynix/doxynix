export default function Loading() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-background text-foreground transition-colors duration-300">
      <div className="flex flex-col items-center gap-4">
        <div className="w-16 h-16 border-4 border-t-accent border-gray-200 rounded-full animate-spin"></div>
        <span className="text-lg font-medium">Загрузка...</span>
      </div>
    </div>
  );
}
