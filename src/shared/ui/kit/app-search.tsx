"use client";

import { Search } from "lucide-react";
import { parseAsInteger, parseAsString, throttle, useQueryStates } from "nuqs";

import { Input } from "@/shared/ui/core/input";

type Props = {
  placeholder: string;
};

const ICON_STYLES = "text-muted-foreground absolute top-2.5 left-2.5";

export function AppSearch({ placeholder }: Readonly<Props>) {
  const [{ search }, setParams] = useQueryStates({
    page: parseAsInteger.withDefault(1).withOptions({ shallow: true }),
    search: parseAsString.withDefault("").withOptions({
      limitUrlUpdates: throttle(100),
      shallow: true,
    }),
  });

  return (
    <div className="relative shrink-0">
      <Search className={ICON_STYLES} />
      <Input
        type="search"
        value={search}
        placeholder={placeholder}
        aria-label={placeholder}
        onChange={(e) => {
          void setParams({ page: null, search: e.target.value || null });
        }}
        className="h-9 border-none pl-8 text-sm"
      />
    </div>
  );
}
