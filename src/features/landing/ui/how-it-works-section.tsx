"use client";

import React, { forwardRef, useRef } from "react";
import { Brain, FileText, User } from "lucide-react";
import { useInView } from "motion/react";
import { useTranslations } from "next-intl";

import { cn } from "@/shared/lib/utils";
import { AblyIcon } from "@/shared/ui/icons/ably-icon";
import { NeonIcon } from "@/shared/ui/icons/neon-icon";
import { TriggerIcon } from "@/shared/ui/icons/trigger-icon";
import { AnimatedBeam } from "@/shared/ui/visuals/animated-beam";

type PathTypes = {
  containerRef: React.RefObject<HTMLDivElement | null>;
  curvature?: number;
  delay?: number;
  duration?: number;
  fromRef: React.RefObject<HTMLDivElement | null>;
  gradientStartColor: string;
  gradientStopColor: string;
  name: string;
  reverse?: boolean;
  toRef: React.RefObject<HTMLDivElement | null>;
};

const Circle = forwardRef<HTMLDivElement, { children?: React.ReactNode; className?: string }>(
  ({ children, className }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "border-border bg-landing-bg-light flex size-12 items-center justify-center rounded-full border-2 p-3 shadow-[0_0_20px_-12px_rgba(0,0,0,0.8)] sm:size-20",
          className
        )}
      >
        {children}
      </div>
    );
  }
);

const COLORS = {
  ably: "#FF5115",
  client: "#ccc",
  db: "#34D59A",
  llm: "#ad46ff",
  trigger: "#41FF54",
};

const STEP_DURATION = 2;
const TOTAL_CYCLE = 14;
const REPEAT_DELAY = TOTAL_CYCLE - STEP_DURATION;

Circle.displayName = "Circle";

export function HowItWorksSection() {
  const t = useTranslations("Landing");

  const containerRef = useRef<HTMLDivElement>(null);
  const clientRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const llmRef = useRef<HTMLDivElement>(null);
  const dbRef = useRef<HTMLDivElement>(null);
  const ablyRef = useRef<HTMLDivElement>(null);

  const isInView = useInView(containerRef, { margin: "-200px", once: true });

  const PATHS: PathTypes[] = [
    {
      containerRef: containerRef,
      delay: 0,
      fromRef: clientRef,
      gradientStartColor: COLORS.trigger,
      gradientStopColor: COLORS.client,
      name: "req",
      toRef: triggerRef,
    },
    {
      containerRef: containerRef,
      delay: STEP_DURATION,
      fromRef: triggerRef,
      gradientStartColor: COLORS.llm,
      gradientStopColor: COLORS.trigger,
      name: "ai-req",
      toRef: llmRef,
    },
    {
      containerRef: containerRef,
      delay: STEP_DURATION * 2,
      fromRef: llmRef,
      gradientStartColor: COLORS.trigger,
      gradientStopColor: COLORS.llm,
      name: "ai-res",
      reverse: true,
      toRef: triggerRef,
    },
    {
      containerRef: containerRef,
      delay: STEP_DURATION * 3,
      fromRef: triggerRef,
      gradientStartColor: COLORS.db,
      gradientStopColor: COLORS.trigger,
      name: "db-save",
      toRef: dbRef,
    },
    {
      containerRef: containerRef,
      delay: STEP_DURATION * 4,
      fromRef: triggerRef,
      gradientStartColor: COLORS.ably,
      gradientStopColor: COLORS.trigger,
      name: "realtime-push",
      toRef: ablyRef,
    },
    {
      containerRef: containerRef,
      delay: STEP_DURATION * 5,
      fromRef: ablyRef,
      gradientStartColor: COLORS.client,
      gradientStopColor: COLORS.ably,
      name: "notify-client",
      reverse: true,
      toRef: clientRef,
    },
  ];

  return (
    <section className="mx-auto flex w-full max-w-7xl flex-col items-center justify-center overflow-hidden px-4 py-24">
      <div className="mb-12 text-center">
        <h2 className="mb-4 text-3xl font-bold md:text-5xl">
          {t("section_how_title_prefix")}{" "}
          <span className="text-muted-foreground">{t("section_how_title_highlight")}</span>
        </h2>
        <p className="text-muted-foreground text-lg">{t("section_how_desc")}</p>
      </div>

      <div
        ref={containerRef}
        className="relative flex w-full items-center justify-between overflow-hidden sm:p-10"
      >
        <div className="flex h-full flex-col justify-center">
          <div className="flex flex-col items-center gap-3">
            <Circle ref={clientRef} className="border-zinc-800">
              <User />
            </Circle>
            <span className="text-muted-foreground text-xs font-semibold sm:text-sm">
              {t("section_how_node_client")}
            </span>
          </div>
        </div>

        <div className="flex h-full flex-col justify-center px-8 md:px-0">
          <div className="flex flex-col items-center gap-3">
            <Circle ref={triggerRef} className="size-16 border-[#41FF54]/40 sm:size-24">
              <TriggerIcon />
            </Circle>
            <div className="flex flex-col items-center">
              <span className="text-muted-foreground text-xs sm:text-sm">
                {" "}
                {t("section_how_node_orchestrator")}
              </span>
            </div>
          </div>
        </div>

        <div className="flex h-full flex-col justify-between gap-8">
          <div className="flex flex-col items-center gap-2">
            <Circle ref={llmRef} className="border-purple-500/40">
              <Brain className="text-purple-500" />
            </Circle>
            <span className="text-muted-foreground text-xs sm:text-sm">
              {" "}
              {t("section_how_node_ai")}
            </span>
          </div>

          <div className="flex flex-col items-center gap-2">
            <Circle ref={dbRef} className="border-[#34D59A]/40">
              <NeonIcon />
            </Circle>
            <span className="text-muted-foreground text-xs sm:text-sm">
              {t("section_how_node_db")}
            </span>
          </div>

          <div className="flex flex-col items-center gap-2">
            <Circle ref={ablyRef} className="border-[#FF5115]/40">
              <AblyIcon />
            </Circle>
            <span className="text-muted-foreground text-xs sm:text-sm">
              {t("section_how_node_ably")}
            </span>
          </div>
        </div>
        {PATHS.map((path) => (
          <AnimatedBeam
            key={path.name}
            containerRef={containerRef}
            curvature={path.curvature}
            delay={path.delay}
            duration={STEP_DURATION}
            fromRef={path.fromRef}
            gradientStartColor={path.gradientStartColor}
            gradientStopColor={path.gradientStopColor}
            isActive={isInView}
            repeatDelay={REPEAT_DELAY}
            reverse={path.reverse}
            toRef={path.toRef}
          />
        ))}
      </div>
      <div className="bg-background/50 mt-8 flex items-center gap-2 rounded-full border px-4 py-1 backdrop-blur-sm">
        <FileText className="text-success h-4 w-4" />
        <span className="text-muted-foreground text-xs">{t("section_how_status_msg")}</span>
      </div>
    </section>
  );
}
