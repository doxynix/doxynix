import { Visibility } from "@prisma/client";

export type RepoItemSchema = {
  fullName: string;
  updatedAt: string;
  description: string | null;
  stars: number;
  language: string | null;
  visibility: Visibility;
};
