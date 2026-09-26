import { Play } from "lucide-react";
import { useTranslations } from "next-intl";

import { Link } from "@/shared/i18n/navigation";
import { AppButton } from "@/shared/ui/core/button";

type Props = { name: string; owner: string };

export function RepoAnalyzeButton({ name, owner }: Readonly<Props>) {
  const t = useTranslations("Dashboard");
  const href = `/dashboard/repo/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/analyze`;

  return (
    <AppButton
      asChild
      className="mt-2"
      size="sm"
      variant="outline"
    >
      <Link href={href}>
        <Play />
        {t("repo_analyze_run")}
      </Link>
    </AppButton>
  );
}
