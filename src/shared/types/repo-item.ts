import type { Visibility } from "@prisma/client";

export type RepoItemFields = {
  fullName: string;
  updatedAt: string;
  description: string | null;
  stars: number;
  language: string | null;
  visibility: Visibility;
};
