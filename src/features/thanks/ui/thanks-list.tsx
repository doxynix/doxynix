"use client";

import { parseAsString, useQueryState } from "nuqs";

import { AppSearch } from "@/shared/ui/kit/app-search";

import { type AuthorGroup } from "../model/thanks.types";
import { ThanksCard } from "./thanks-card";

type Props = {
  initialGroups: AuthorGroup[];
};

export function ThanksList({ initialGroups }: Readonly<Props>) {
  const [search] = useQueryState("search", parseAsString.withDefault(""));

  const getFiltered = () => {
    const s = search.trim().toLowerCase();
    if (!s) return initialGroups;

    return initialGroups
      .map((group) => {
        const isAuthorMatch = group.author.toLowerCase().includes(s);

        const matchingPackages = group.packages.filter((pkg) => pkg.name.toLowerCase().includes(s));

        return {
          ...group,
          packages: isAuthorMatch ? group.packages : matchingPackages,
        };
      })
      .filter((group) => group.packages.length > 0);
  };

  const filtered = getFiltered();

  return (
    <>
      <div className="mb-8 ml-auto w-fit">
        <AppSearch placeholder="Search libraries..." />
      </div>

      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {filtered.map((group) => (
            <ThanksCard key={group.author} group={group} />
          ))}
        </div>
      ) : (
        <div className="text-muted-foreground py-20 text-center">
          Nothing found for &quot;<span className="max-w-60 truncate">{search}</span>&quot;
        </div>
      )}
    </>
  );
}
