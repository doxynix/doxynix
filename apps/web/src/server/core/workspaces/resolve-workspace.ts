import { TRPCError } from "@trpc/server";
import * as z from "zod";

import { prisma } from "../db";
import { createPersonalWorkspace } from "./personal-workspace";

type WorkspaceRole = "MEMBER" | "OWNER";

export type ResolvedWorkspace = {
  id: string;
  reset: boolean;
  role: WorkspaceRole;
};

export async function resolveWorkspace(input: {
  headerWorkspaceId: null | string;
  name?: null | string;
  strict?: boolean;
  userId: string;
}): Promise<ResolvedWorkspace> {
  const { headerWorkspaceId, name, strict = false, userId } = input;

  if (headerWorkspaceId != null && z.uuid().safeParse(headerWorkspaceId).success) {
    const membership = await prisma.workspaceMember.findUnique({
      select: { role: true },
      where: { workspaceId_userId: { userId, workspaceId: headerWorkspaceId } },
    });

    if (membership != null) {
      return { id: headerWorkspaceId, reset: false, role: membership.role };
    }

    if (strict) {
      const workspaceExists = await prisma.workspace.findUnique({
        select: { id: true },
        where: { id: headerWorkspaceId },
      });

      if (workspaceExists != null) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Workspace access denied" });
      }
    }
  }

  const fallback = await prisma.workspaceMember.findFirst({
    orderBy: { createdAt: "asc" },
    select: { role: true, workspaceId: true },
    where: { userId },
  });

  if (fallback != null) {
    return { id: fallback.workspaceId, reset: headerWorkspaceId != null, role: fallback.role };
  }

  const workspaceId = await createPersonalWorkspace(userId, name);

  return { id: workspaceId, reset: headerWorkspaceId != null, role: "OWNER" };
}
