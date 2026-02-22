import { cn } from "@/shared/lib/utils";
import type { StatItem } from "@/shared/types/stat-item";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/core/card";

type Props = { item: StatItem };

export function StatCard({ item }: Readonly<Props>) {
  return (
    <Card className="hover:bg-muted/50 transition-colors">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{item.label}</CardTitle>
        <div className={cn("rounded-full p-2", item.className)}>
          <item.icon className={cn("h-4 w-4", item.iconClass)} />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{item.value}</div>
        <p className="text-muted-foreground text-xs">{item.description}</p>
      </CardContent>
    </Card>
  );
}
