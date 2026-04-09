import { task } from "@trigger.dev/sdk/v3";

import {
  formatQuickFileAuditMarkdown,
  runQuickFileAudit,
  type FileActionNodeContext,
} from "../model/file-actions";

export const analyzeFileTask = task({
  id: "analyze-single-file",
  run: async (payload: {
    content: string;
    language: string;
    nodeContext?: FileActionNodeContext;
    path: string;
  }) => {
    const audit = await runQuickFileAudit(payload);

    return {
      feedback: formatQuickFileAuditMarkdown(audit),
      path: payload.path,
      type: "AUDIT",
    };
  },
});
