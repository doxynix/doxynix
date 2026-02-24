"use client";

import React, { useEffect, useState, useTransition } from "react";
import type { Route } from "next";
import { useSearchParams } from "next/navigation";
import { Search } from "lucide-react";

import { cn } from "@/shared/lib/utils";
import { Input } from "@/shared/ui/core/input";
import { Spinner } from "@/shared/ui/core/spinner";
import { usePathname, useRouter } from "@/i18n/routing";

type Props = {
  placeholder: string;
};

const ICON_STYLES = "text-muted-foreground absolute top-2.5 left-2.5 h-4 w-4";

export function AppSearch({ placeholder }: Readonly<Props>) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const { replace } = useRouter();

  const urlSearch = searchParams.get("search") || "";
  const [term, setTerm] = useState(urlSearch);
  const [debouncedTerm, setDebouncedTerm] = useState(term);
  const [isPending, startTransition] = useTransition();

  React.useEffect(() => {
    setTerm(urlSearch);
  }, [urlSearch]);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedTerm(term);
    }, 300);

    return () => clearTimeout(handler);
  }, [term]);

  useEffect(() => {
    if (debouncedTerm === urlSearch) return;

    const params = new URLSearchParams(searchParams);
    params.delete("page");

    if (debouncedTerm) {
      params.set("search", debouncedTerm);
    } else {
      params.delete("search");
    }

    startTransition(() => {
      replace(`${pathname}?${params.toString()}` as Route, { scroll: false });
    });
  }, [debouncedTerm, pathname, replace, searchParams, urlSearch]);

  return (
    <div className="relative shrink-0">
      {isPending ? (
        <Spinner className={cn(ICON_STYLES, "animate-spin")} />
      ) : (
        <Search className={ICON_STYLES} />
      )}
      <Input
        type="search"
        value={term}
        placeholder={placeholder}
        onChange={(e) => {
          setTerm(e.target.value);
        }}
        className="focus-visible:bg-background h-9 border-none pl-8 text-sm"
      />
    </div>
  );
}
