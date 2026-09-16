"use client";

import { useState } from "react";
import Image from "next/image";

import { getSizesFromClassName, isUnoptimizedHost } from "@/shared/lib/avatar-utils";
import { cn } from "@/shared/lib/cn";
import { getInitials } from "@/shared/lib/get-initials";
import { Avatar, AvatarFallback } from "@/shared/ui/core/avatar";
import { Skeleton } from "@/shared/ui/core/skeleton";

type Props = {
  alt: string;
  className?: string;
  fallbackClassName?: string;
  fallbackText?: string;
  priority?: boolean;
  sizeClassName?: string;
  src?: null | string;
};

const loadedAvatars = new Map<string, boolean>();

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

  const [status, setStatus] = useState<"error" | "loading" | "success">(() => {
    if (!hasSrc) {
      return "error";
    }
    if (loadedAvatars.get(src) === true) {
      return "success";
    }
    return "loading";
  });

  const [prevSrc, setPrevSrc] = useState(src);

  if (src !== prevSrc) {
    setPrevSrc(src);
    if (!hasSrc) {
      setStatus("error");
    } else if (loadedAvatars.get(src) === true) {
      setStatus("success");
    } else {
      setStatus("loading");
    }
  }

  const isError = status === "error";
  const isEmpty = typeof src !== "string" || src === "";
  const showFallback = isEmpty || isError;

  return (
    <Avatar className={cn(sizeClassName, "select-none border border-border", className)}>
      {!showFallback && status === "loading" && (
        <Skeleton className="absolute inset-0 z-10 rounded-full" />
      )}

      {hasSrc && !isError && (
        <Image
          alt={alt}
          className={cn(
            "object-cover transition-opacity duration-300",
            status === "success" ? "opacity-100" : "opacity-0",
          )}
          fill
          loading={priority ? undefined : "lazy"}
          onError={() => {
            console.error("Image load error:", src);
            setStatus("error");
          }}
          onLoad={() => {
            if (src) {
              loadedAvatars.set(src, true);
            }
            setStatus("success");
          }}
          priority={priority}
          sizes={getSizesFromClassName(sizeClassName)}
          src={src}
          unoptimized={isUnoptimizedHost(src)}
        />
      )}

      {showFallback && (
        <AvatarFallback className={cn("bg-secondary text-secondary-foreground", fallbackClassName)}>
          {fallbackText != null ? getInitials(fallbackText) : alt.slice(0, 2).toUpperCase()}
        </AvatarFallback>
      )}
    </Avatar>
  );
}
