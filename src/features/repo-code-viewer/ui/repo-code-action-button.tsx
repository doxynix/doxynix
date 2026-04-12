import type { ReactNode } from "react";

import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/core/button";
import { AppTooltip } from "@/shared/ui/kit/app-tooltip";
import { ExternalLink } from "@/shared/ui/kit/external-link";

type Props = {
  children: ReactNode;
  className?: string;
  disabled?: boolean;
  hidden?: boolean;
  hideTooltip?: boolean;
  href?: string;
  onClick?: () => void;
  tooltipText: string;
  variant?: "default" | "ghost" | "outline";
};

export function RepoCodeActionButton({
  children,
  className,
  disabled,
  hidden,
  hideTooltip,
  href,
  onClick,
  tooltipText,
  variant = "ghost",
}: Readonly<Props>) {
  if (hidden === true) return null;

  const buttonElement = (
    <Button
      disabled={disabled}
      size="sm"
      variant={variant}
      aria-label={tooltipText}
      onClick={onClick}
      className={cn("gap-1.5 text-xs", className)}
    >
      {children}
    </Button>
  );

  return (
    <AppTooltip content={tooltipText} hidden={hideTooltip}>
      {href != null ? (
        <Button
          asChild
          size="sm"
          variant={variant}
          className={cn("gap-1.5 px-2 text-xs", className)}
        >
          <ExternalLink href={href} aria-label={tooltipText} className="px-3">
            {children}
          </ExternalLink>
        </Button>
      ) : (
        buttonElement
      )}
    </AppTooltip>
  );
}
