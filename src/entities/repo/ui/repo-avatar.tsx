"use client";

import { useState } from "react";
import Image from "next/image";

import { cn, loadedAvatars } from "@/shared/lib/utils";
import { Skeleton } from "@/shared/ui/core/skeleton";

export function RepoAvatar({ src, alt }: { src: string | null; alt: string }) {
  const imageSrc = src ?? "/avatar-placeholder.png";
  const [loaded, setLoaded] = useState(loadedAvatars.get(imageSrc) ?? false);

  return (
    <div className="bg-muted relative h-9 w-9 shrink-0 overflow-hidden rounded-full border">
      {!loaded && <Skeleton className="absolute inset-0" />}
      <Image
        src={imageSrc}
        alt={alt}
        priority
        fill
        className={cn(
          "rounded-xl object-cover transition-opacity duration-300",
          loaded ? "opacity-100" : "opacity-0"
        )}
        onLoad={() => {
          loadedAvatars.set(imageSrc, true);
          setLoaded(true);
        }}
      />
    </div>
  );
}
