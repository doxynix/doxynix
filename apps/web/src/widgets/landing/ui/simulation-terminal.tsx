"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";
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
    <div className="glass-panel pointer-events-none flex h-full w-full flex-col overflow-hidden rounded-2xl border border-border bg-card">
      <div className="flex items-center gap-1.5 border-border border-b bg-muted p-3">
        <div className="size-3 rounded-full bg-destructive/80" />
        <div className="size-3 rounded-full bg-warning/80" />
        <div className="size-3 rounded-full bg-success/80" />
        <div className="ml-2 font-medium text-muted-foreground text-xs">bash</div>
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
    if (!isInView) {
      return;
    }

    let isMounted = true;

    const delay = (ms: number) => {
      return new Promise<void>((resolve) => {
        const timer = setTimeout(() => {
          if (isMounted) {
            resolve();
          }
        }, ms);
        return () => clearTimeout(timer);
      });
    };

    const timeline = async () => {
      if (!isMounted) {
        return;
      }
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
    <div className="h-full w-full" ref={containerRef}>
      <TerminalWindow>
        <div className="flex items-center text-muted-foreground">
          <span className="mr-2 text-success">➜</span>
          <span className="font-medium text-foreground">~/project</span>
          <span className="ml-2 text-foreground">{typedCommand}</span>
          {step <= 1 && (
            <span className="ml-1 inline-block h-4 w-2 animate-blink-cursor bg-muted-foreground align-middle" />
          )}
        </div>

        <div className="mt-2 flex flex-col gap-1">
          {step >= 3 && (
            <div className="fade-in slide-in-from-left-2 animate-in text-muted-foreground duration-200">
              {t("section_terminal_step_analyzed")}
            </div>
          )}

          {step >= 4 && (
            <div className="fade-in slide-in-from-left-2 flex animate-in items-center gap-2 duration-200">
              <Check className="size-3 text-success" />
              <span>{t("section_terminal_step_parsing")}</span>
            </div>
          )}

          {step >= 5 && (
            <div className="fade-in slide-in-from-left-2 flex animate-in items-center gap-2 duration-200">
              <Check className="size-3 text-success" />
              <span>{t("section_terminal_step_relationships")}</span>
            </div>
          )}

          {step >= 6 && (
            <div className="fade-in slide-in-from-left-2 flex animate-in items-center gap-2 duration-200">
              <Check className="size-3 text-success" />
              <span>{t("section_terminal_step_generating")}</span>
            </div>
          )}
        </div>

        {step >= 7 && (
          <div className="fade-in slide-in-from-left-2 mt-4 animate-in rounded-xl border border-success/20 bg-success/10 p-2.5 text-success duration-300">
            {t("section_terminal_step_success_prefix")}{" "}
            <span className="underline underline-offset-4">/docs/README.md</span>
          </div>
        )}

        {step >= 8 && (
          <div className="fade-in slide-in-from-left-2 mt-4 flex animate-in items-start gap-2 text-muted-foreground duration-300">
            <span className="text-foreground">{t("section_terminal_step_wait_prefix")}</span>
            <span>{t("section_terminal_step_wait_suffix")}</span>
            <span className="inline-block h-4 w-2 animate-blink-cursor bg-foreground" />
          </div>
        )}
      </TerminalWindow>
    </div>
  );
}
