"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import type { Route } from "next";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";

import { Input } from "@/shared/ui/core/input";
import { Spinner } from "@/shared/ui/core/spinner";

import { cn } from "../../lib/utils";

type Props = {
  placeholder: string;
};

const ICON_STYLES = "text-muted-foreground absolute top-2.5 left-2.5 h-4 w-4";

export function AppSearch({ placeholder }: Props) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const { replace } = useRouter();

  const urlSearch = searchParams.get("search") || "";
  const [term, setTerm] = useState(urlSearch);
  const [isPending, startTransition] = useTransition();

  const isResetting = useRef(false);

  useEffect(() => {
    if (urlSearch !== term) {
      isResetting.current = true;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTerm(urlSearch);
    }
  }, [urlSearch, searchParams, term]);

  useEffect(() => {
    if (isResetting.current) {
      isResetting.current = false;
      return;
    }

    if (term === urlSearch) return;

    const handler = setTimeout(() => {
      const params = new URLSearchParams(searchParams);
      params.delete("page");

      if (term) {
        params.set("search", term);
      } else {
        params.delete("search");
      }

      startTransition(() => {
        replace(`${pathname}?${params.toString()}` as Route, { scroll: false });
      });
    }, 300);
    return () => clearTimeout(handler);
  }, [term, pathname, replace, urlSearch, searchParams]);

  return (
    <div className="relative shrink-0">
      {isPending ? (
        <Spinner className={cn(ICON_STYLES, "animate-spin")} />
      ) : (
        <Search className={ICON_STYLES} />
      )}
      <Input
        type="search"
        placeholder={placeholder}
        className="focus-visible:bg-background h-9 border-none pl-8 text-sm"
        value={term}
        onChange={(e) => {
          isResetting.current = false;
          setTerm(e.target.value);
        }}
      />
    </div>
  );
}
