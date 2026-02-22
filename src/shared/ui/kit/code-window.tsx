import { useTranslations } from "next-intl";

import { cn } from "@/shared/lib/utils";
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
        "bg-landing-bg-dark border-landing-bg-light overflow-hidden rounded-xl border",
        className
      )}
    >
      <div className="bg-landing-bg-light/50 flex items-center justify-between border-b border-zinc-800 p-3">
        <div className="flex items-center">
          <div className="flex gap-1.5">
            <div className="bg-destructive/80 h-3 w-3 rounded-full" />
            <div className="bg-warning/80 h-3 w-3 rounded-full" />
            <div className="bg-success/80 h-3 w-3 rounded-full" />
          </div>
          <div className="text-muted-foreground ml-4 flex items-center gap-2 font-mono text-xs">
            <span>{title}</span>
          </div>
        </div>
        {copyButtonVisible && (
          <CopyButton value={code ?? ""} tooltipText={t("copy_code")} className="opacity-100" />
        )}
      </div>
      <div
        dangerouslySetInnerHTML={{ __html: codeHtml }}
        className={cn(
          "overflow-x-auto p-6 font-mono leading-relaxed [&>pre]:bg-transparent! [&>pre]:p-0!",
          codeClassName
        )}
      />
    </div>
  );
}
