"use client";

import { useState } from "react";
import Image from "next/image";

import { cn } from "@/shared/lib/cn";
import { getInitials } from "@/shared/lib/get-initials";
import { loadedAvatars } from "@/shared/lib/load-state";
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

const SIZE_MAP: Record<string, string> = {
  "size-6": "24px",
  "size-8": "32px",
  "size-9": "36px",
  "size-10": "40px",
  "size-12": "48px",
  "size-16": "64px",
  "size-24": "96px",
  "size-32": "128px",
};

function getSizesFromClassName(sizeClassName: string): string {
  for (const [key, value] of Object.entries(SIZE_MAP)) {
    if (sizeClassName.includes(key)) return value;
  }
  return "48px";
}

function isUnoptimizedHost(src: string): boolean {
  try {
    const url = new URL(src);
    const protocol = url.protocol.toLowerCase();

    if (protocol !== "http:" && protocol !== "https:") {
      return true;
    }

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

  const [status, setStatus] = useState<"error" | "loading" | "success">(() => {
    if (!hasSrc) return "error";
    if (loadedAvatars.get(src) === true) return "success";
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
          sizes={getSizesFromClassName(sizeClassName)}
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
          {fallbackText != null ? getInitials(fallbackText) : alt.slice(0, 2).toUpperCase()}
        </AvatarFallback>
      )}
    </Avatar>
  );
}
