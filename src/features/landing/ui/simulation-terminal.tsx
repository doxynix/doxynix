"use client";

import { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";
import { useInView } from "motion/react";
import { useTranslations } from "next-intl";

export const TerminalWindow = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="border-border pointer-events-none flex h-full w-full flex-col overflow-hidden rounded-xl border">
      <div className="border-border/50 bg-muted/20 flex items-center gap-1.5 border-b p-3">
        <div className="bg-destructive/80 h-3 w-3 rounded-full" />
        <div className="bg-warning/80 h-3 w-3 rounded-full" />
        <div className="bg-success/80 h-3 w-3 rounded-full" />
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

    const timeline = async () => {
      setStep(1);
      for (let i = 0; i <= FULL_COMMAND.length; i++) {
        setTypedCommand(FULL_COMMAND.slice(0, i));
        await new Promise((r) => setTimeout(r, Math.random() * 200 + 30));
      }

      await new Promise((r) => setTimeout(r, 500));
      setStep(2);

      await new Promise((r) => setTimeout(r, 600));
      setStep(3);

      await new Promise((r) => setTimeout(r, 400));
      setStep(4);

      await new Promise((r) => setTimeout(r, 300));
      setStep(5);

      await new Promise((r) => setTimeout(r, 500));
      setStep(6);

      await new Promise((r) => setTimeout(r, 600));
      setStep(7);

      await new Promise((r) => setTimeout(r, 400));
      setStep(8);
    };

    void timeline();
  }, [isInView]);

  return (
    <div ref={containerRef} className="h-full w-full">
      <TerminalWindow>
        <div className="text-muted-foreground flex items-center">
          <span className="text-success mr-2">➜</span>
          <span className="text-blue">~/project</span>
          <span className="text-foreground ml-2">{typedCommand}</span>
          {step <= 1 && (
            <span className="animate-blink-cursor bg-muted-foreground ml-1 inline-block h-4 w-2 align-middle" />
          )}
        </div>

        <div className="mt-2 space-y-1">
          {step >= 3 && (
            <div className="animate-in fade-in slide-in-from-left-2 text-muted-foreground duration-300">
              {t("section_terminal_step_analyzed")}
            </div>
          )}

          {step >= 4 && (
            <div className="animate-in fade-in slide-in-from-left-2 flex items-center gap-2 duration-300">
              <Check className="text-success h-3 w-3" />
              <span>{t("section_terminal_step_parsing")}</span>
            </div>
          )}

          {step >= 5 && (
            <div className="animate-in fade-in slide-in-from-left-2 flex items-center gap-2 duration-300">
              <Check className="text-success h-3 w-3" />
              <span>{t("section_terminal_step_relationships")}</span>
            </div>
          )}

          {step >= 6 && (
            <div className="animate-in fade-in slide-in-from-left-2 flex items-center gap-2 duration-300">
              <Check className="text-success h-3 w-3" />
              <span>{t("section_terminal_step_generating")}</span>
            </div>
          )}
        </div>

        {step >= 7 && (
          <div className="animate-in fade-in slide-in-from-left-2 bg-success/10 border-success/20 text-success mt-4 rounded border p-2 duration-500">
            {t("section_terminal_step_success_prefix")}{" "}
            <span className="underline underline-offset-4">/docs/README.md</span>
          </div>
        )}

        {step >= 8 && (
          <div className="animate-in fade-in slide-in-from-left-2 text-muted-foreground mt-4 flex items-start gap-2 duration-500">
            <span className="text-blue">{t("section_terminal_step_wait_prefix")}</span>
            <span>{t("section_terminal_step_wait_suffix")}</span>
            <span className="animate-blink-cursor bg-blue inline-block h-4 w-2" />
          </div>
        )}
      </TerminalWindow>
    </div>
  );
}
