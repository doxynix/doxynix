import { trpc } from "@/core/client";

export const githubService = {
  async connectRepo(url: string) {
    return trpc.repo.create.mutate({ url });
  },

  async getBranches(owner: string, name: string) {
    return trpc.githubBrowse.getBranches.query({ name, owner });
  },

  async getFileContent(repoId: string, path: string, branch?: string) {
    return trpc.githubBrowse.getFileContent.query({ branch, path, repoId });
  },

  async getInstallUrl() {
    return trpc.githubApp.getGithubInstallUrl.query({});
  },

  async getMyRepos() {
    return trpc.githubApp.getMyGithubRepos.query({});
  },

  async getRepoFiles(owner: string, name: string, branch?: string) {
    return trpc.githubBrowse.getRepoFiles.query({ branch, name, owner });
  },

  async searchGithub(query: string) {
    return trpc.githubBrowse.searchGithub.query({ query });
  },
};
