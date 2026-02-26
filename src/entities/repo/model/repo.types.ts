export type SearchParams = {
  page?: string;
  search?: string;
  sortBy?: string;
  sortOrder?: string;
  status?: string;
  visibility?: string;
};

export type FileTuple = [string, number, string, number];

export type FileNode = {
  children?: FileNode[];
  id: string;
  name: string;
  path: string;
  recommended?: boolean;
  sha: string;
  type: string;
};
