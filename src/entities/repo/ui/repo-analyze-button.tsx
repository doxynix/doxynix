import { Play } from "lucide-react";

import { Link } from "@/shared/i18n/routing";
import { AppButton } from "@/shared/ui/core/button";

type Props = { name: string; owner: string };

export function RepoAnalyzeButton({ name, owner }: Readonly<Props>) {
  const href = `/dashboard/repo/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/analyze`;

  return (
    <AppButton asChild size="sm" variant="outline" className="mt-2 cursor-pointer">
      <Link href={href}>
        <Play />
        Run Analysis
      </Link>
    </AppButton>
  );
}
