"use client";

import { Search } from "lucide-react";
import { parseAsInteger, useQueryStates } from "nuqs";

import { searchTextParam } from "@/shared/lib/search-params";
import { Input } from "@/shared/ui/core/input";

type Props = {
  placeholder: string;
};

const ICON_STYLES = "text-muted-foreground absolute top-2.5 left-2.5";

export function AppSearch({ placeholder }: Readonly<Props>) {
  const [{ search }, setParams] = useQueryStates({
    page: parseAsInteger.withDefault(1),
    search: searchTextParam,
  });

  return (
    <div className="relative shrink-0">
      <Search className={ICON_STYLES} />
      <Input
        aria-label={placeholder}
        className="h-9 border-none pl-8 text-sm"
        onChange={(e) => {
          void setParams({ page: null, search: e.target.value || null });
        }}
        placeholder={placeholder}
        type="search"
        value={search}
      />
    </div>
  );
}
