import type { VisibilityType } from "@/generated/zod";

export type RepoItemFields = {
  description: null | string;
  fullName: string;
  language: null | string;
  languageColor?: string;
  stars: number;
  updatedAt: string;
  visibility: VisibilityType;
};
