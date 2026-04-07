import { task } from "@trigger.dev/sdk/v3";

import {
  runDocumentFilePreview,
  type FileActionNodeContext,
} from "@/server/features/file-actions/model/file-actions";

export const documentFileTask = task({
  id: "document-single-file",
  run: async (payload: {
    content: string;
    language: string;
    nodeContext?: FileActionNodeContext;
    path: string;
    repoId: string;
  }) => {
    const documentedCode = await runDocumentFilePreview(payload);

    return {
      code: documentedCode.documentation,
      path: payload.path,
      type: "DOCUMENTATION",
    };
  },
});
