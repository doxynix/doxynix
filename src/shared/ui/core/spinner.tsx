import { Loader2Icon } from "lucide-react";

import { cn } from "@/shared/lib/utils";

function Spinner({ className, ...props }: Readonly<React.ComponentProps<"svg">>) {
  return (
    <output aria-label="Loading">
      <Loader2Icon className={cn("size-4 animate-spin", className)} {...props} />
    </output>
  );
}

export { Spinner };
