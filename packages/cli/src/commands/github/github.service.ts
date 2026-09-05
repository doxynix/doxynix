import { trpc } from "@/core/client";

const getAppRouter = () => (trpc as any).githubApp ?? (trpc as any).github;
const getBrowseRouter = () => (trpc as any).githubBrowse ?? (trpc as any).github;

export interface GithubRepoItem {
  id?: number | string;
  name: string;
  owner: string;
  fullName?: string;
  url?: string;
  html_url?: string;
  isPrivate?: boolean;
  private?: boolean;
  description?: string | null;
  defaultBranch?: string;
  language?: string | null;
}

export const githubService = {
  async connectRepo(url: string) {
    return trpc.repo.create.mutate({ url });
  },

  async getBranches(owner: string, name: string): Promise<any[]> {
    return getBrowseRouter().getBranches.query({ name, owner });
  },

  async getFileContent(repoId: string, path: string, branch?: string): Promise<any> {
    return getBrowseRouter().getFileContent.query({ branch, path, repoId });
  },
  async getInstallUrl(): Promise<string> {
    const res = await getAppRouter().getGithubInstallUrl.query({});
    if (typeof res === "string") {
      return res;
    }
    return res.url ?? res.installUrl ?? "";
  },

  async getMyRepos(): Promise<GithubRepoItem[]> {
    const res = await getAppRouter().getMyGithubRepos.query({});
    if (Array.isArray(res)) {
      return res;
    }
    return res.repositories ?? res.repos ?? res.items ?? [];
  },

  async getRepoFiles(owner: string, name: string, branch?: string): Promise<any[]> {
    return getBrowseRouter().getRepoFiles.query({ branch, name, owner });
  },

  async searchGithub(query: string): Promise<any> {
    return getBrowseRouter().searchGithub.query({ query });
  },
};
