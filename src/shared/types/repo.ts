import type { Visibility } from "@prisma/client";

export type RepoItemFields = {
  description: string | null;
  fullName: string;
  language: string | null;
  stars: number;
  updatedAt: string;
  visibility: Visibility;
};
