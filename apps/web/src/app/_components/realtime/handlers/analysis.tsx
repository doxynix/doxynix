import { toast } from "sonner";

import { REALTIME_CONFIG } from "@/shared/config/realtime";

import type { DashboardStats } from "@/widgets/dashboard/model/dashboard.types";

import { parseRealtimePayload, RealtimeUserPayloads } from "../../realtime-payloads";
import { patchAnalysisProgress } from "../analysis-progress";
import type { RealtimeDeps, RealtimeHandlers } from "../deps";

export function analysisHandlers({
  invalidate,
  queryClient,
  t,
  trpc,
}: RealtimeDeps): RealtimeHandlers {
  return {
    [REALTIME_CONFIG.events.user.analysisProgress]: (message) => {
      const payload = parseRealtimePayload(
        RealtimeUserPayloads[REALTIME_CONFIG.events.user.analysisProgress],
        message.data,
      );

      if (payload == null) {
        return;
      }

      queryClient.setQueriesData(
        trpc.analytics.getDashboardStats.pathFilter(),
        (oldData: DashboardStats | undefined) => patchAnalysisProgress(oldData, payload),
      );

      if (payload.status === "DONE" || payload.status === "FAILED") {
        invalidate();
      }

      // `analysisUpdated` covers the success path, but a failed run publishes only progress, so the
      // analysis queries are refreshed here for `FAILED` alone.
      if (payload.status === "FAILED") {
        void queryClient.invalidateQueries(trpc.analysis.getLatest.pathFilter());
        void queryClient.invalidateQueries(trpc.analysis.getHistory.pathFilter());
        void queryClient.invalidateQueries(trpc.analysis.getVersionRef.pathFilter());
      }
    },
    [REALTIME_CONFIG.events.user.analysisUpdated]: () => {
      void queryClient.invalidateQueries(trpc.analysis.getLatest.pathFilter());
      void queryClient.invalidateQueries(trpc.analysis.getHistory.pathFilter());
      void queryClient.invalidateQueries(trpc.analysis.getVersionRef.pathFilter());
      void queryClient.invalidateQueries(trpc.user.getOnboardingState.pathFilter());
    },
    [REALTIME_CONFIG.events.user.fileActionCompleted]: (message) => {
      const payload = parseRealtimePayload(RealtimeUserPayloads.fileActionCompleted, message.data);

      if (payload == null) {
        return;
      }

      if (payload.type === "FIX_GENERATED" && payload.fixId != null) {
        void queryClient.invalidateQueries(
          trpc.analysis.getById.queryFilter({ fixId: payload.fixId }),
        );
        toast.success(t("realtime_fix_ready"));
        return;
      }

      if (payload.path == null) {
        return;
      }

      const action = payload.type === "AUDIT" ? "quick-file-audit" : "document-file-preview";

      void queryClient.invalidateQueries(
        trpc.analysis.getFileActionResult.queryFilter({ action, path: payload.path }),
      );
      toast.success(
        payload.type === "AUDIT" ? t("realtime_file_audit_done") : t("realtime_file_document_done"),
      );
    },
  };
}
