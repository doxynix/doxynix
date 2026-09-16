"use client";

import { parseAsString, useQueryState } from "nuqs";

import { AppSearch } from "@/shared/ui/kit/app-search";

import { ThanksCard } from "@/entities/thanks/ui/thanks-card";

import type { AuthorGroup } from "../model/thanks.types";
import { filterAuthorGroups } from "../model/thanks-filters";

type Props = {
  initialGroups: AuthorGroup[];
};

export function ThanksList({ initialGroups }: Readonly<Props>) {
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
            <ThanksCard
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
