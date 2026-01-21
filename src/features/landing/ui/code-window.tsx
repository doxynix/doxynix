import { cn } from "@/shared/lib/utils";
import { CopyButton } from "@/shared/ui/kit/copy-button";

type Props = {
  title: string;
  code: string;
  codeClassName?: string;
  codeHtml: string;
  className?: string;
};

export function CodeWindow({ title, code, codeClassName, codeHtml, className }: Props) {
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
        <CopyButton tooltipText="Copy code" className="opacity-100" value={code} />
      </div>
      <div
        className={cn(
          "overflow-x-auto p-6 font-mono leading-relaxed [&>pre]:bg-transparent! [&>pre]:p-0!",
          codeClassName
        )}
        dangerouslySetInnerHTML={{ __html: codeHtml }}
      />
    </div>
  );
}
