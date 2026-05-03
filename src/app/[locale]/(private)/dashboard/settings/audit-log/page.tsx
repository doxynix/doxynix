import { AuditLogsContainer } from "@/features/audit-logs/ui/audit-logs-container";

export default function AuditLogPage() {
  return (
    <div className="flex h-[calc(100vh-220px)] flex-col space-y-6 overflow-hidden">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Audit Log</h1>
        <p className="text-muted-foreground text-sm">
          A record of important events in your account
        </p>
      </div>

      <AuditLogsContainer />
    </div>
  );
}
