import { Octokit } from "@octokit/rest";
import { PrismaClient } from "@prisma/client";

export const githubService = {
  parseUrl(input: string) {
    let clean = input.trim().replace(/^https?:\/\/(www\.)?github\.com\//, "");

    clean = clean.replace(/^\/+|\/+$/g, "");

    const parts = clean.split("/").map((part) => part.trim());
    if (parts.length < 2 || !parts[0] || !parts[1]) {
      throw new Error("Неверный формат");
    }

    return { owner: parts[0], name: parts[1] };
  },

  async getClientForUser(userId: number, prisma: PrismaClient) {
    const account = await prisma.account.findFirst({
      where: { userId, provider: "github" },
    });

    const token = account?.access_token ?? process.env.GITHUB_TOKEN;
    if (token !== null) console.warn("Нет токена GitHub");

    return new Octokit({ auth: token });
  },

  async getRepoInfo(userId: number, owner: string, name: string, prisma: PrismaClient) {
    const octokit = await this.getClientForUser(userId, prisma);
    const { data } = await octokit.repos.get({ owner, repo: name });

    return data;
  },
};
