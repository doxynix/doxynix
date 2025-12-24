"use client";

import { useRouter } from "next/navigation";

import { Button } from "@/shared/ui/button";

export default function BackButton() {
  const router = useRouter();

  return (
    <div className="flex gap-4">
      <Button className="cursor-pointer" onClick={() => router.back()}>
        Назад
      </Button>
    </div>
  );
}
