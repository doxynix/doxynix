import { Spinner } from "@/shared/ui/spinner";

export default function PageLoader() {
  return (
    <div className="bg-background flex h-screen flex-col items-center justify-center gap-4">
      <Spinner className="h-16 w-16" />
      <span className="animate-pulse text-xl">Загрузка...</span>
    </div>
  );
}
