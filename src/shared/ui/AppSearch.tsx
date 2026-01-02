"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";

import { Input } from "@/shared/ui/input";
import { Spinner } from "@/shared/ui/spinner";

interface AppSearchProps {
  placeholder: string;
}

export function AppSearch({ placeholder }: AppSearchProps) {
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
  }, [urlSearch, searchParams]);

  useEffect(() => {
    if (isResetting.current) {
      isResetting.current = false;
      return;
    }

    if (term === urlSearch) return;

    const handler = setTimeout(() => {
      const params = new URLSearchParams(searchParams);
      params.set("page", "1");

      if (term) {
        params.set("search", term);
      } else {
        params.delete("search");
      }

      startTransition(() => {
        replace(`${pathname}?${params.toString()}`, { scroll: false });
      });
    }, 300);
    return () => clearTimeout(handler);
  }, [term, pathname, replace]);

  return (
    <div className="relative">
      {isPending ? (
        <Spinner className="text-muted-foreground absolute top-2.5 left-2.5 h-4 w-4 animate-spin" />
      ) : (
        <Search className="text-muted-foreground absolute top-2.5 left-2.5 h-4 w-4" />
      )}
      <Input
        type="search"
        placeholder={placeholder}
        className="focus-visible:bg-background h-9 border-none pl-8"
        value={term}
        onChange={(e) => {
          isResetting.current = false;
          setTerm(e.target.value);
        }}
      />
    </div>
  );
}
