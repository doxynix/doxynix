import { useTranslations } from "next-intl";

import { cn } from "@/shared/lib/cn";
import { CopyButton } from "@/shared/ui/kit/copy-button";

type Props = {
  className?: string;
  code?: string;
  codeClassName?: string;
  codeHtml: string;
  copyButtonVisible?: boolean;
  title: string;
};

export function CodeWindow({
  className,
  code,
  codeClassName,
  codeHtml,
  copyButtonVisible = true,
  title,
}: Readonly<Props>) {
  const t = useTranslations("Common");

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-landing-bg-light bg-landing-bg-dark",
        className,
      )}
    >
      <div className="flex items-center justify-between border-border border-b bg-landing-bg-light/50 p-3">
        <div className="flex items-center">
          <div className="flex gap-1.5">
            <div className="size-3 rounded-full bg-destructive/80" />
            <div className="size-3 rounded-full bg-warning/80" />
            <div className="size-3 rounded-full bg-success/80" />
          </div>
          <div className="ml-4 flex items-center gap-2 font-mono text-muted-foreground text-xs">
            <span>{title}</span>
          </div>
        </div>
        {copyButtonVisible && (
          <CopyButton className="opacity-100" tooltipText={t("copy_code")} value={code ?? ""} />
        )}
      </div>
      <div
        className={cn(
          "overflow-x-auto p-6 font-mono leading-relaxed [&>pre]:bg-transparent! [&>pre]:p-0!",
          codeClassName,
        )}
        dangerouslySetInnerHTML={{ __html: codeHtml }}
      />
    </div>
  );
}
