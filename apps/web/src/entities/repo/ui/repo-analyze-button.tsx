import { Play } from "lucide-react";

import { Link } from "@/shared/i18n/navigation";
import { AppButton } from "@/shared/ui/core/button";

type Props = { name: string; owner: string };

export function RepoAnalyzeButton({ name, owner }: Readonly<Props>) {
  const href = `/dashboard/repo/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/analyze`;

  return (
    <AppButton asChild className="mt-2 cursor-pointer" size="sm" variant="outline">
      <Link href={href}>
        <Play />
        Run Analysis
      </Link>
    </AppButton>
  );
}
