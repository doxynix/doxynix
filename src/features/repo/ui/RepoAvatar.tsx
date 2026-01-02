"use client";

import { useState } from "react";
import Image from "next/image";

import { cn, loadedAvatars } from "@/shared/lib/utils";
import { Skeleton } from "@/shared/ui/skeleton";

export function RepoAvatar({ src, alt }: { src: string | null; alt: string }) {
  const imageSrc = src ?? "/avatar-placeholder.png";
  const [loaded, setLoaded] = useState(loadedAvatars.get(imageSrc) ?? false);

  return (
    <div className="bg-muted relative h-20 w-20 shrink-0 overflow-hidden rounded-md border">
      {!loaded && <Skeleton className="absolute inset-0" />}
      <Image
        src={imageSrc}
        alt={alt}
        priority
        fill
        className={cn(
          "rounded-md object-cover transition-opacity duration-300",
          loaded ? "opacity-100" : "opacity-0"
        )}
        onLoadingComplete={() => {
          loadedAvatars.set(imageSrc, true);
          setLoaded(true);
        }}
      />
    </div>
  );
}
