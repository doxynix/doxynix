import type { WorkspaceRole } from "@doxynix/shared";
import { MessageCode } from "@doxynix/shared";
import * as z from "zod";

import { AppError } from "@/server/core/api-error";
import { requestContext } from "@/server/utils/request-context";
import { memoizeOnce } from "@/server/utils/request-memo";

import { prisma } from "../db";
import { createPersonalWorkspace } from "./personal-workspace";

export type ResolvedWorkspace = {
  id: string;
  reset: boolean;
  role: WorkspaceRole;
};

type ResolveWorkspaceInput = {
  headerWorkspaceId: null | string;
  name?: null | string;
  strict?: boolean;
  userId: string;
};

async function loadWorkspace(input: ResolveWorkspaceInput): Promise<ResolvedWorkspace> {
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
        throw new AppError({
          code: "FORBIDDEN",
          messageCode: MessageCode.WORKSPACE_ACCESS_DENIED,
          publicMessage: "Workspace access denied",
        });
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

// Mirrors the entitlement reader: request-scoped dedupe, not a cache. A page render opens several
// workspace-scoped procedures and every agent tool call opens one; they all need the same answer.
export async function resolveWorkspace(input: ResolveWorkspaceInput): Promise<ResolvedWorkspace> {
  return memoizeOnce(
    requestContext.getStore()?.workspaceMemo,
    "workspace",
    [input.userId, input.headerWorkspaceId, input.strict === true, input.name ?? null],
    () => loadWorkspace(input),
  );
}
