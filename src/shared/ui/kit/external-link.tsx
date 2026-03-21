import React from "react";

import { cn } from "@/shared/lib/utils";

type ExternalLinkProps = React.AnchorHTMLAttributes<HTMLAnchorElement> & {
  children: React.ReactNode;
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
