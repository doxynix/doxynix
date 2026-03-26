import type { AnchorHTMLAttributes, ReactNode } from "react";

import { cn } from "@/shared/lib/utils";

type ExternalLinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  children: ReactNode;
  href: string;
};

export function ExternalLink({ children, className, href, ...props }: ExternalLinkProps) {
  return (
    <a
      href={href}
      rel="noopener noreferrer"
      target="_blank"
      className={cn("transition-colors", className)}
      {...props}
    >
      {children}
    </a>
  );
}
