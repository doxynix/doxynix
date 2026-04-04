import { Play } from "lucide-react";

import { Button } from "@/shared/ui/core/button";
import { Link } from "@/i18n/routing";

type Props = { name: string; owner: string };

export function RepoAnalyzeButton({ name, owner }: Readonly<Props>) {
  return (
    <Button asChild size="sm" variant="outline" className="mt-2 cursor-pointer">
      <Link href={`/dashboard/repo/${owner}/${name}/analyze`}>
        <Play className="size-4" />
        Run Analysis
      </Link>
    </Button>
  );
}
