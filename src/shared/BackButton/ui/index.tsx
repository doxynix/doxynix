"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";

export default function BackButton() {
  const router = useRouter();

  return (
    <div className="flex gap-4">
      <Button className="cursor-pointer">
        <Link href="/dashboard">На дашборд</Link>
      </Button>
      <Button className="cursor-pointer" onClick={() => router.back()}>
        Назад
      </Button>
    </div>
  );
}
