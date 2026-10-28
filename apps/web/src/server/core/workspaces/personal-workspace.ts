import { prisma } from "../db";

export const PERSONAL_WORKSPACE_ENTITLEMENT = {
  aiTokensPerMonth: 1_000_000,
  analysesPerMonth: 20,
  autoResync: false,
  historyDays: 7,
  planCode: "HOBBY",
  privateReposAllowed: false,
  prReviews: false,
  reposLimit: null,
  seatLimit: 1,
} as const;

export function personalWorkspaceName(name?: null | string): string {
  const trimmed = name?.trim();

  return trimmed == null || trimmed.length === 0 ? "Personal workspace" : `${trimmed} workspace`;
}

export async function createPersonalWorkspace(
  userId: string,
  name?: null | string,
): Promise<string> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId}))`;

    const existing = await tx.workspaceMember.findFirst({
      orderBy: { createdAt: "asc" },
      select: { workspaceId: true },
      where: { userId },
    });

    if (existing != null) {
      return existing.workspaceId;
    }

    const workspace = await tx.workspace.create({
      data: {
        entitlement: { create: PERSONAL_WORKSPACE_ENTITLEMENT },
        members: { create: { role: "OWNER", userId } },
        name: personalWorkspaceName(name),
      },
      select: { id: true },
    });

    return workspace.id;
  });
}
