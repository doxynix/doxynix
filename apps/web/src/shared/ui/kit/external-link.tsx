import type { AnchorHTMLAttributes, ReactNode } from "react";

import { cn } from "@/shared/lib/cn";

type ExternalLinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  children: ReactNode;
  href: string;
};

export function ExternalLink({ children, className, href, ...props }: ExternalLinkProps) {
  return (
    <a
      className={cn("transition-colors", className)}
      href={href}
      rel="noopener noreferrer nofollow"
      target="_blank"
      {...props}
    >
      {children}
    </a>
  );
}
