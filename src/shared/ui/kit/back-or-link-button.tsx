"use client";

import type { Route } from "next";
import { MoveLeft } from "lucide-react";

import { Link, useRouter } from "@/shared/i18n/routing";
import { cn } from "@/shared/lib/cn";
import { AppButton, type ButtonProps } from "@/shared/ui/core/button";

type BackOrLinkButtonProps = ButtonProps & {
  href?: Route;
  label?: string;
  showIcon?: boolean;
};

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
      {showIcon && <MoveLeft className="mr-2" />}
      {label || children}
    </>
  );

  if (href) {
    return (
      <AppButton asChild variant={variant} className={cn("w-fit", className)} {...props}>
        <Link href={href}>{content}</Link>
      </AppButton>
    );
  }

  return (
    <AppButton
      variant={variant}
      onClick={() => router.back()}
      className={cn("w-fit", className)}
      {...props}
    >
      {content}
    </AppButton>
  );
}
