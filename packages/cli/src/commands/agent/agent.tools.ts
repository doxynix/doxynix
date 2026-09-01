import { trpc } from "@/core/client";

export interface PendingToolCall {
  toolCallId: string;
  toolName: string;
  input: Record<string, unknown>;
  hasExecutedOnServer: boolean;
}

export async function executeClientAction(
  toolName: string,
  input: Record<string, unknown>,
): Promise<{ success: boolean; message: string }> {
  switch (toolName) {
    case "revokeApiKey": {
      const rawId = input.id ?? input.keyIdentifier ?? input.name;
      let targetId = typeof rawId === "string" ? rawId : "";

      if (targetId && !targetId.includes("-")) {
        const keys = await trpc.apikey.list.query({});
        const found = keys.active.find((k) => k.name === targetId || k.prefix.includes(targetId));
        if (found) {
          targetId = found.id;
        }
      }

      const res = await trpc.apikey.revoke.mutate({ id: targetId });
      return { message: res.message, success: true };
    }

    case "deleteRepository": {
      const rawId = input.id ?? input.repoId;
      const id = typeof rawId === "string" ? rawId : "";
      const res = await trpc.repo.delete.mutate({ id });
      return { message: res.message, success: true };
    }

    case "registerRepository": {
      const url = typeof input.url === "string" ? input.url : "";
      const res = await trpc.repo.create.mutate({ url });
      return {
        message: `Repository ${res.repo.owner}/${res.repo.name} connected successfully.`,
        success: true,
      };
    }

    case "triggerRepositoryAnalysis": {
      const repoId = typeof input.repoId === "string" ? input.repoId : "";
      const res = await trpc.analysis.analyze.mutate({
        docTypes: ["README", "ARCHITECTURE", "CODE_DOC"],
        files: [],
        language: "English",
        repoId,
      });
      return { message: `Analysis triggered (Job ID: ${res.jobId})`, success: true };
    }

    default: {
      return { message: `Tool ${toolName} executed successfully.`, success: true };
    }
  }
}
