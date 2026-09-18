"use client";

import { parseAsString, useQueryState } from "nuqs";

import { AppSearch } from "@/shared/ui/kit/app-search";

import { HighFiveCard } from "@/entities/high-five/ui/high-five-card";

import type { AuthorGroup } from "../model/high-five.types";
import { filterAuthorGroups } from "../model/high-five-filters";

type Props = {
  initialGroups: AuthorGroup[];
};

export function HighFiveList({ initialGroups }: Readonly<Props>) {
  const [search] = useQueryState("search", parseAsString.withDefault(""));

  const filtered = filterAuthorGroups(initialGroups, search);

  return (
    <>
      <div className="mb-8 ml-auto w-fit">
        <AppSearch placeholder="Search libraries..." />
      </div>

      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {filtered.map((group) => (
            <HighFiveCard
              group={group}
              key={group.author}
            />
          ))}
        </div>
      ) : (
        <div className="py-20 text-center text-muted-foreground">
          Nothing found for &quot;<span className="max-w-60 truncate">{search}</span>&quot;
        </div>
      )}
    </>
  );
}
