import type { ComponentProps } from "react";
import { Loader2Icon } from "lucide-react";
import { useTranslations } from "next-intl";

import { cn } from "@/shared/lib/cn";

function Spinner({ className, ...props }: Readonly<ComponentProps<"svg">>) {
  const tCommon = useTranslations("Common");
  return (
    <output aria-label={tCommon("loading")}>
      <Loader2Icon
        className={cn("animate-spin", className)}
        {...props}
      />
    </output>
  );
}

export { Spinner };
