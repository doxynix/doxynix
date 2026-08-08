import type { ComponentProps } from "react";
import { Loader2Icon } from "lucide-react";

import { cn } from "@/shared/lib/cn";

function Spinner({ className, ...props }: Readonly<ComponentProps<"svg">>) {
  return (
    <output aria-label="Loading">
      <Loader2Icon className={cn("animate-spin", className)} {...props} />
    </output>
  );
}

export { Spinner };
