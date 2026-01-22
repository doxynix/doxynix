import { Spinner } from "@/shared/ui/core/spinner";

export function PageLoader() {
  return (
    <div className="flex h-full min-h-full w-full min-w-full flex-1 flex-col items-center justify-center gap-4">
      <Spinner className="h-12 w-12" />
      <span className="text-muted-foreground animate-pulse text-sm font-medium">Loading...</span>
    </div>
  );
}
