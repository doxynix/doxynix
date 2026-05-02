"use client";

import type { RepoPull } from "@/entities/pr/model/pr.types";
import { RepoPullCard } from "@/entities/pr/ui/repo-pull-card";

type Props = {
  name: string;
  owner: string;
  pulls: RepoPull[];
};

export function RepoPullsList({ name, owner, pulls }: Readonly<Props>) {
  return (
    <div className="flex flex-col gap-3">
      {pulls.map((pull) => (
        <RepoPullCard key={pull.id} name={name} owner={owner} pull={pull} />
      ))}
    </div>
  );
}
