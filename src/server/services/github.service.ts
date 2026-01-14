import { Octokit } from "@octokit/rest";
import { PrismaClient } from "@prisma/client";

import { logger } from "@/shared/lib/logger";

export const githubService = {
  parseUrl(input: string) {
    if (!input) throw new Error("Поле не может быть пустым");

    const clean = input
      .trim()
      .replace(/^git@github\.com:/, "")
      .replace(/^(https?:\/\/)?(www\.)?github\.com\//, "")
      .replace(/\.git$/, "")
      .replace(/^\/+|\/+$/g, "");

    const parts = clean.split("/");

    const owner = parts[0]?.trim();
    const name = parts[1]?.trim();

    if (!owner || !name) {
      throw new Error("Неверный формат. Введите 'owner/name' или ссылку на репозиторий");
    }

    return { owner, name };
  },
  async searchRepos(prisma: PrismaClient, userId: number, query: string) {
    if (query.length < 2) return [];

    const octokit = await this.getClientForUser(prisma, userId);

    try {
      const { data } = await octokit.search.repos({
        q: query,
        per_page: 5,
      });

      return data.items.map((repo) => ({
        fullName: repo.full_name,
        description: repo.description,
        owner: repo.owner?.login,
        name: repo.name,
        stars: repo.stargazers_count,
      }));
    } catch (error) {
      logger.error({ msg: "Ошибка поиска в GitHub", error });
      return [];
    }
  },
  async getMyRepos(prisma: PrismaClient, userId: number) {
    const octokit = await this.getClientForUser(prisma, userId);
    const { data } = await octokit.repos.listForAuthenticatedUser({
      sort: "updated",
      per_page: 5,
      visibility: "all",
    });
    return data.map((repo) => ({
      fullName: repo.full_name,
      stars: repo.stargazers_count,
      private: repo.private,
    }));
  },
  async getClientForUser(prisma: PrismaClient, userId: number) {
    const account = await prisma.account.findFirst({
      where: { userId, provider: "github" },
    });

    const token = account?.access_token ?? process.env.GITHUB_TOKEN;
    if (token === null) logger.warn({ msg: "Нет токена GitHub" });

    return new Octokit({ auth: token, userAgent: "Doxynix" });
  },

  async getRepoInfo(prisma: PrismaClient, userId: number, owner: string, name: string) {
    const octokit = await this.getClientForUser(prisma, userId);
    const { data } = await octokit.repos.get({ owner, repo: name });

    return data;
  },
};
