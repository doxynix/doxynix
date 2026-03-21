import { cn } from "@/shared/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/core/card";

type Props = {
  className?: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  iconClass?: string;
  label: string;
  value: string | number;
};

export function StatCard({
  className,
  description,
  icon: Icon,
  iconClass,
  label,
  value,
}: Readonly<Props>) {
  return (
    <Card className="hover:border-border-strong transition-colors">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{label}</CardTitle>
        <div className={cn("rounded-full p-2", className)}>
          <Icon className={cn("size-4", iconClass)} />
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-muted-foreground text-xs">{description}</p>
      </CardContent>
    </Card>
  );
}
