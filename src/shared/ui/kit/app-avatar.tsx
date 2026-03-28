"use client";

import React, { useState } from "react";
import Image from "next/image";

import { cn, getInitials, loadedAvatars } from "@/shared/lib/utils";
import { Avatar, AvatarFallback } from "@/shared/ui/core/avatar";
import { Skeleton } from "@/shared/ui/core/skeleton";

type Props = {
  alt: string;
  className?: string;
  fallbackClassName?: string;
  fallbackText?: string;
  priority?: boolean;
  sizeClassName?: string;
  src?: string | null;
};

function isUnoptimizedHost(src: string): boolean {
  try {
    const url = new URL(src);
    const hostname = url.hostname.toLowerCase();

    const allowedHosts = ["utfs.io", "ufs.sh"];

    return allowedHosts.some((allowed) => {
      return hostname === allowed || hostname.endsWith("." + allowed);
    });
  } catch {
    return false;
  }
}

export function AppAvatar({
  alt,
  className,
  fallbackClassName,
  fallbackText,
  priority = false,
  sizeClassName = "size-9",
  src,
}: Readonly<Props>) {
  const hasSrc = typeof src === "string" && src !== "";

  const [status, setStatus] = useState<"loading" | "error" | "success">(() => {
    if (!hasSrc) return "error";
    if (loadedAvatars.get(src) === true) return "success";
    return "loading";
  });

  React.useEffect(() => {
    if (hasSrc) {
      if (loadedAvatars.get(src) === true) {
        setStatus("success");
      } else {
        setStatus("loading");
      }
    } else {
      setStatus("error");
    }
  }, [hasSrc, src]);

  const isError = status === "error";
  const isEmpty = typeof src !== "string" || src === "";
  const showFallback = isEmpty || isError;

  return (
    <Avatar className={cn(sizeClassName, "border-border border select-none", className)}>
      {!showFallback && status === "loading" && (
        <Skeleton className="absolute inset-0 z-10 rounded-full" />
      )}

      {hasSrc && !isError && (
        <Image
          fill
          alt={alt}
          loading={priority ? undefined : "lazy"}
          priority={priority}
          sizes={sizeClassName.includes("size-24") ? "96px" : "48px"}
          src={src}
          unoptimized={isUnoptimizedHost(src)}
          onError={() => {
            console.error("Image load error:", src);
            setStatus("error");
          }}
          onLoad={() => {
            if (src) loadedAvatars.set(src, true);
            setStatus("success");
          }}
          className={cn(
            "object-cover transition-opacity duration-300",
            status === "success" ? "opacity-100" : "opacity-0"
          )}
        />
      )}

      {showFallback && (
        <AvatarFallback className={cn("bg-secondary text-secondary-foreground", fallbackClassName)}>
          {fallbackText != null ? getInitials(fallbackText) : alt.substring(0, 2).toUpperCase()}
        </AvatarFallback>
      )}
    </Avatar>
  );
}
