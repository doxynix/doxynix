"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Check } from "lucide-react";
import { useInView } from "motion/react";
import { useTranslations } from "next-intl";

const TERMINAL_STEPS = [
  { delay: 500, step: 2 },
  { delay: 600, step: 3 },
  { delay: 400, step: 4 },
  { delay: 300, step: 5 },
  { delay: 500, step: 6 },
  { delay: 600, step: 7 },
  { delay: 400, step: 8 },
] as const;

const TerminalWindow = ({ children }: { children: ReactNode }) => {
  return (
    <div className="glass-panel border-border bg-card pointer-events-none flex h-full w-full flex-col overflow-hidden rounded-2xl border">
      <div className="border-border bg-muted flex items-center gap-1.5 border-b p-3">
        <div className="bg-destructive/80 size-3 rounded-full" />
        <div className="bg-warning/80 size-3 rounded-full" />
        <div className="bg-success/80 size-3 rounded-full" />
        <div className="text-muted-foreground ml-2 text-xs font-medium">bash</div>
      </div>
      <div className="flex-1 overflow-hidden p-4 font-mono text-xs leading-relaxed sm:text-sm">
        {children}
      </div>
    </div>
  );
};

export function SimulationTerminal() {
  const t = useTranslations("Landing");

  const containerRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(containerRef, { amount: 0.5, once: true });

  const [step, setStep] = useState(0);
  const [typedCommand, setTypedCommand] = useState("");

  const FULL_COMMAND = "npx doxynix generate";

  useEffect(() => {
    if (!isInView) return;

    let isMounted = true;

    const delay = (ms: number) => {
      return new Promise<void>((resolve) => {
        const timer = setTimeout(() => {
          if (isMounted) resolve();
        }, ms);
        return () => clearTimeout(timer);
      });
    };

    const timeline = async () => {
      if (!isMounted) return;
      setStep(1);

      for (let i = 0; i <= FULL_COMMAND.length; i++) {
        setTypedCommand(FULL_COMMAND.slice(0, i));
        await delay(Math.random() * 200 + 30);
      }

      for (const config of TERMINAL_STEPS) {
        await delay(config.delay);
        setStep(config.step);
      }
    };

    void timeline();

    return () => {
      isMounted = false;
    };
  }, [isInView]);

  return (
    <div ref={containerRef} className="h-full w-full">
      <TerminalWindow>
        <div className="text-muted-foreground flex items-center">
          <span className="text-success mr-2">➜</span>
          <span className="text-foreground font-medium">~/project</span>
          <span className="text-foreground ml-2">{typedCommand}</span>
          {step <= 1 && (
            <span className="animate-blink-cursor bg-muted-foreground ml-1 inline-block h-4 w-2 align-middle" />
          )}
        </div>

        <div className="mt-2 flex flex-col gap-1">
          {step >= 3 && (
            <div className="animate-in fade-in slide-in-from-left-2 text-muted-foreground duration-200">
              {t("section_terminal_step_analyzed")}
            </div>
          )}

          {step >= 4 && (
            <div className="animate-in fade-in slide-in-from-left-2 flex items-center gap-2 duration-200">
              <Check className="text-success size-3" />
              <span>{t("section_terminal_step_parsing")}</span>
            </div>
          )}

          {step >= 5 && (
            <div className="animate-in fade-in slide-in-from-left-2 flex items-center gap-2 duration-200">
              <Check className="text-success size-3" />
              <span>{t("section_terminal_step_relationships")}</span>
            </div>
          )}

          {step >= 6 && (
            <div className="animate-in fade-in slide-in-from-left-2 flex items-center gap-2 duration-200">
              <Check className="text-success size-3" />
              <span>{t("section_terminal_step_generating")}</span>
            </div>
          )}
        </div>

        {step >= 7 && (
          <div className="animate-in fade-in slide-in-from-left-2 bg-success/10 border-success/20 text-success mt-4 rounded-xl border p-2.5 duration-300">
            {t("section_terminal_step_success_prefix")}{" "}
            <span className="underline underline-offset-4">/docs/README.md</span>
          </div>
        )}

        {step >= 8 && (
          <div className="animate-in fade-in slide-in-from-left-2 text-muted-foreground mt-4 flex items-start gap-2 duration-300">
            <span className="text-foreground">{t("section_terminal_step_wait_prefix")}</span>
            <span>{t("section_terminal_step_wait_suffix")}</span>
            <span className="animate-blink-cursor bg-foreground inline-block h-4 w-2" />
          </div>
        )}
      </TerminalWindow>
    </div>
  );
}
