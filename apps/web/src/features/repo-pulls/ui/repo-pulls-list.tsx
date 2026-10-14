"use client";

import { useTranslations } from "next-intl";

import type { RepoPull } from "@/entities/pr/model/pr.types";
import { RepoPullCard } from "@/entities/pr/ui/repo-pull-card";

type Props = {
  capped: boolean;
  name: string;
  owner: string;
  pulls: RepoPull[];
  total: number;
};

export function RepoPullsList({ capped, name, owner, pulls, total }: Readonly<Props>) {
  const tCommon = useTranslations("Common");

  return (
    <div className="flex flex-col gap-3">
      {pulls.map((pull) => (
        <RepoPullCard
          key={pull.id}
          name={name}
          owner={owner}
          pull={pull}
        />
      ))}
      {capped && (
        <p className="text-muted-foreground text-xs">{tCommon("capped_hint", { count: total })}</p>
      )}
    </div>
  );
}
