import { trpc } from "@/core/client";

export const githubService = {
  async connectRepo(url: string) {
    return trpc.repo.create.mutate({ url });
  },

  async getBranches(owner: string, name: string): Promise<any[]> {
    return trpc.githubBrowse.getBranches.query({ name, owner });
  },

  async getFileContent(repoId: string, path: string, branch?: string): Promise<any> {
    return trpc.githubBrowse.getFileContent.query({ branch, path, repoId });
  },

  async getInstallUrl(): Promise<string> {
    const res = await trpc.githubApp.getGithubInstallUrl.query({});
    if (typeof res === "string") {
      return res;
    }
    return (res as any).url ?? (res as any).installUrl ?? "";
  },

  async getMyRepos(): Promise<any> {
    const res = await trpc.githubApp.getMyGithubRepos.query({});
    if (Array.isArray(res)) {
      return res;
    }
    return (res as any).repositories ?? (res as any).repos ?? (res as any).items ?? [];
  },

  async getRepoFiles(owner: string, name: string, branch?: string): Promise<any[]> {
    return trpc.githubBrowse.getRepoFiles.query({ branch, name, owner });
  },

  async searchGithub(query: string): Promise<any> {
    return trpc.githubBrowse.searchGithub.query({ query });
  },
};
