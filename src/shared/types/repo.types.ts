export type RepoVisibility = "PRIVATE" | "PUBLIC";

export type RepoItemFields = {
  description: null | string;
  fullName: string;
  language: null | string;
  stars: number;
  updatedAt: string;
  visibility: RepoVisibility;
};
