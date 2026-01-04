"use client";

import { useRouter } from "next/navigation";

import { Button } from "@/shared/ui/button";

type Props = { href?: string; text: string };

export default function BackOrLinkButton({ href, text }: Props) {
  const router = useRouter();
  const handleClick = () => {
    if (href) {
      router.push(href);
    } else {
      router.back();
    }
  };

  return (
    <div className="flex gap-4">
      <Button className="cursor-pointer" onClick={() => handleClick()}>
        {text}
      </Button>
    </div>
  );
}
