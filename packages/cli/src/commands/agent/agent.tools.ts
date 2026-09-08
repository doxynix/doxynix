import { analyzeService } from "../analyze/analyze.service";
import { keysService } from "../keys/keys.service";
import { reposService } from "../repos/repos.service";

export async function executeClientAction(
  toolName: string,
  input: Record<string, unknown>,
): Promise<{ message: string; success: boolean }> {
  switch (toolName) {
    case "revokeApiKey": {
      const rawId = input.id ?? input.keyIdentifier ?? input.name;
      let targetId = typeof rawId === "string" ? rawId : "";

      if (targetId && !targetId.includes("-")) {
        const keys = await keysService.list();
        const found = keys.active.find((k) => k.name === targetId || k.prefix.includes(targetId));
        if (found) {
          targetId = found.id;
        }
      }

      const res = await keysService.revoke(targetId);
      return { message: res.message, success: true };
    }

    case "deleteRepository": {
      const rawId = input.id ?? input.repoId;
      const id = typeof rawId === "string" ? rawId : "";
      const res = await reposService.delete(id);
      return { message: res.message, success: true };
    }

    case "registerRepository": {
      const url = typeof input.url === "string" ? input.url : "";
      const res = await reposService.add(url);
      return {
        message: `Repository ${res.repo.owner}/${res.repo.name} connected successfully.`,
        success: true,
      };
    }

    case "triggerRepositoryAnalysis": {
      const repoId = typeof input.repoId === "string" ? input.repoId : "";
      const res = await analyzeService.analyze({
        docTypes: ["README", "ARCHITECTURE", "CODE_DOC"],
        files: [],
        language: "English",
        repoId,
      });
      return { message: `Analysis triggered (Job ID: ${res.jobId})`, success: true };
    }

    default: {
      throw new Error(`Unsupported tool action: '${toolName}'. No registered client handler.`);
    }
  }
}
