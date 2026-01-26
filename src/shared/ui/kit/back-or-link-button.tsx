"use client";

import type { Route } from "next";
import { MoveLeft } from "lucide-react";

import { cn } from "@/shared/lib/utils";
import { Button, type ButtonProps } from "@/shared/ui/core/button";

import { Link, useRouter } from "@/i18n/routing";

interface BackOrLinkButtonProps extends ButtonProps {
  href?: Route;
  label?: string;
  showIcon?: boolean;
}

export function BackOrLinkButton({
  href,
  label,
  showIcon = false,
  className,
  children,
  variant = "outline",
  ...props
}: BackOrLinkButtonProps) {
  const router = useRouter();

  const content = (
    <>
      {showIcon && <MoveLeft className="mr-2 h-4 w-4" />}
      {label || children}
    </>
  );

  if (href) {
    return (
      <Button variant={variant} className={cn("w-fit", className)} asChild {...props}>
        <Link href={href}>{content}</Link>
      </Button>
    );
  }

  return (
    <Button
      variant={variant}
      className={cn("w-fit", className)}
      onClick={() => router.back()}
      {...props}
    >
      {content}
    </Button>
  );
}
