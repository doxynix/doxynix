import type { ReactNode } from "react";

import { Badge } from "@/shared/ui/core/badge";
import { Card, CardContent } from "@/shared/ui/core/card";

type Props = {
  action: ReactNode;
  description: string;
  icon: ReactNode;
  status?: string;
  title: string;
};

export function ConnectionCard({ action, description, icon, status, title }: Readonly<Props>) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex size-6 items-center justify-center">{icon}</div>

          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm">{title}</span>
              {status != null && (
                <Badge variant="outline" className="text-success">
                  {status}
                </Badge>
              )}
            </div>
            <p className="text-muted-foreground line-clamp-1 text-xs">{description}</p>
          </div>
        </div>

        <div className="flex items-center px-2">{action}</div>
      </CardContent>
    </Card>
  );
}
