export type PendingAction = "audit" | "document" | null;

type AuditPanelInput = {
  isAuditDismissed: boolean;
  isAuditLoaded: boolean;
  pending: PendingAction;
};

export const isBusy = (pending: PendingAction) => pending !== null;

export const shouldShowAuditPanel = ({
  isAuditDismissed,
  isAuditLoaded,
  pending,
}: AuditPanelInput) => !isAuditDismissed && (pending === "audit" || isAuditLoaded);
