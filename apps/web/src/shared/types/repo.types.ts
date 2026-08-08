import type { VisibilityType } from "../api-contracts";

export type RepoItemFields = {
  description: null | string;
  fullName: string;
  language: null | string;
  languageColor?: string;
  stars: number;
  updatedAt: string;
  visibility: VisibilityType;
};
