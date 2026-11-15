"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import Image from "next/image";

import { getSizesFromClassName, isUnoptimizedHost } from "@/shared/lib/avatar-utils";
import { cn } from "@/shared/lib/cn";
import { getInitials } from "@/shared/lib/get-initials";
import { Avatar, AvatarFallback } from "@/shared/ui/core/avatar";
import { Skeleton } from "@/shared/ui/core/skeleton";

type AvatarStatus = "error" | "loading" | "success";

const loadedAvatars = new Set<string>();
const erroredAvatars = new Set<string>();
const avatarListeners = new Set<() => void>();

function emitAvatarChange() {
  for (const listener of avatarListeners) {
    listener();
  }
}

function subscribeAvatars(listener: () => void) {
  avatarListeners.add(listener);

  return () => {
    avatarListeners.delete(listener);
  };
}

function avatarStatus(src: null | string | undefined): AvatarStatus {
  if (typeof src !== "string" || src === "") {
    return "error";
  }
  if (erroredAvatars.has(src)) {
    return "error";
  }
  if (loadedAvatars.has(src)) {
    return "success";
  }
  return "loading";
}

function serverAvatarStatus(src: null | string | undefined): AvatarStatus {
  return typeof src === "string" && src !== "" ? "loading" : "error";
}

function markAvatarLoaded(src: string) {
  erroredAvatars.delete(src);
  loadedAvatars.add(src);
  emitAvatarChange();
}

function markAvatarErrored(src: string) {
  loadedAvatars.delete(src);
  erroredAvatars.add(src);
  emitAvatarChange();
}

type Props = {
  alt: string;
  className?: string;
  fallbackClassName?: string;
  fallbackText?: string;
  priority?: boolean;
  sizeClassName?: string;
  src?: null | string;
};

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
  const status = useSyncExternalStore(
    subscribeAvatars,
    () => avatarStatus(src),
    () => serverAvatarStatus(src),
  );
  const imageRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (!src || !imageRef.current?.complete || imageRef.current.naturalWidth === 0) {
      return;
    }

    markAvatarLoaded(src);
  }, [src]);

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
            if (src) {
              markAvatarErrored(src);
            }
          }}
          onLoad={() => {
            if (src) {
              markAvatarLoaded(src);
            }
          }}
          priority={priority}
          ref={imageRef}
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
