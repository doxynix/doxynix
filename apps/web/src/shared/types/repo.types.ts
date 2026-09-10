import type { Visibility } from "@doxynix/shared";

export type RepoItemFields = {
  description: null | string;
  fullName: string;
  language: null | string;
  languageColor?: string;
  stars: number;
  updatedAt: string;
  visibility: Visibility;
};
