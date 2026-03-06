"use client";

import { Search } from "lucide-react";
import { parseAsString, throttle, useQueryState } from "nuqs";

import { Input } from "@/shared/ui/core/input";

type Props = {
  placeholder: string;
};

const ICON_STYLES = "text-muted-foreground absolute top-2.5 left-2.5 h-4 w-4";

export function AppSearch({ placeholder }: Readonly<Props>) {
  const [search, setSearch] = useQueryState(
    "search",
    parseAsString.withDefault("").withOptions({
      limitUrlUpdates: throttle(100),
      shallow: true,
    })
  );

  return (
    <div className="relative shrink-0">
      <Search className={ICON_STYLES} />
      <Input
        type="search"
        value={search}
        placeholder={placeholder}
        onChange={(e) => {
          void setSearch(e.target.value || null);
        }}
        className="h-9 border-none pl-8 text-sm"
      />
    </div>
  );
}
