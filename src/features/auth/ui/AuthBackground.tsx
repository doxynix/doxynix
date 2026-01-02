"use client";

import { useState } from "react";
import Image from "next/image";

import { cn } from "@/shared/lib/utils";

export function AuthBackground() {
  const [isLoaded, setIsLoaded] = useState(false);

  return (
    <div className="bg-background fixed inset-0 z-10">
      <Image
        src="/auth_bg.svg"
        alt="Authentication background"
        fill
        priority
        className={cn(
          "object-cover object-center",
          "transition-opacity duration-500 ease-in-out",
          isLoaded ? "opacity-100" : "opacity-0"
        )}
        onLoad={() => setIsLoaded(true)}
      />
    </div>
  );
}
