import type { ReactNode } from "react";

import { cn } from "@/shared/lib/cn";
import { AppButton } from "@/shared/ui/core/button";
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
  if (hidden === true) {
    return null;
  }

  const buttonElement = (
    <AppButton
      aria-label={tooltipText}
      className={cn("gap-1.5 text-xs", className)}
      disabled={disabled}
      onClick={onClick}
      size="sm"
      variant={variant}
    >
      {children}
    </AppButton>
  );

  return (
    <AppTooltip content={tooltipText} hidden={hideTooltip}>
      {href != null ? (
        <AppButton
          asChild
          className={cn("gap-1.5 px-2 text-xs", className)}
          size="sm"
          variant={variant}
        >
          <ExternalLink aria-label={tooltipText} className="px-3" href={href}>
            {children}
          </ExternalLink>
        </AppButton>
      ) : (
        buttonElement
      )}
    </AppTooltip>
  );
}
