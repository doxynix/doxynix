export type RepoCodeMode = "edit" | "view";

export type RepoCodeDiff = {
  originalValue: string;
};

export const isReadOnly = (mode: RepoCodeMode) => mode === "view";
