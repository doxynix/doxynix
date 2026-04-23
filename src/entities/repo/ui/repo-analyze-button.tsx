import { Play } from "lucide-react";

import { Button } from "@/shared/ui/core/button";
import { Link } from "@/i18n/routing";

type Props = { name: string; owner: string };

export function RepoAnalyzeButton({ name, owner }: Readonly<Props>) {
  const href = `/dashboard/repo/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/analyze`;

  return (
    <Button asChild size="sm" variant="outline" className="mt-2 cursor-pointer">
      <Link href={href}>
        <Play />
        Run Analysis
      </Link>
    </Button>
  );
}
