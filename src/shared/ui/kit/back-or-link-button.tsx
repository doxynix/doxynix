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
  children,
  className,
  href,
  label,
  showIcon = false,
  variant = "outline",
  ...props
}: Readonly<BackOrLinkButtonProps>) {
  const router = useRouter();

  const content = (
    <>
      {showIcon && <MoveLeft className="mr-2 h-4 w-4" />}
      {label || children}
    </>
  );

  if (href) {
    return (
      <Button asChild variant={variant} className={cn("w-fit", className)} {...props}>
        <Link href={href}>{content}</Link>
      </Button>
    );
  }

  return (
    <Button
      variant={variant}
      onClick={() => router.back()}
      className={cn("w-fit", className)}
      {...props}
    >
      {content}
    </Button>
  );
}
