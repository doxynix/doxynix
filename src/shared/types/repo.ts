export type FileNode = {
  children?: FileNode[];
  id: string;
  name: string;
  path: string;
  recommended?: boolean;
  sha: string;
  type: string;
};
