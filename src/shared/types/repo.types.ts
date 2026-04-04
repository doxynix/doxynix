import type { RepoVisibility } from "../api/trpc";

export type RepoItemFields = {
  description: string | null;
  fullName: string;
  language: string | null;
  stars: number;
  updatedAt: string;
  visibility: RepoVisibility;
};
