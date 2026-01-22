"use client";

import React, { forwardRef, useRef } from "react";
import { Brain, FileText, User } from "lucide-react";
import { useInView } from "motion/react";

import { cn } from "@/shared/lib/utils";
import { AblyIcon } from "@/shared/ui/icons/ably-icon";
import { NeonIcon } from "@/shared/ui/icons/neon-icon";
import { TriggerIcon } from "@/shared/ui/icons/trigger-icon";
import { AnimatedBeam } from "@/shared/ui/visuals/animated-beam";

type PathTypes = {
  name: string;
  containerRef: React.RefObject<HTMLDivElement | null>;
  fromRef: React.RefObject<HTMLDivElement | null>;
  toRef: React.RefObject<HTMLDivElement | null>;
  gradientStartColor: string;
  gradientStopColor: string;
  curvature?: number;
  reverse?: boolean;
  duration?: number;
  delay?: number;
};

const Circle = forwardRef<HTMLDivElement, { className?: string; children?: React.ReactNode }>(
  ({ className, children }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "border-border bg-landing-bg-light z-10 flex size-12 items-center justify-center rounded-full border-2 p-3 shadow-[0_0_20px_-12px_rgba(0,0,0,0.8)] sm:size-20",
          className
        )}
      >
        {children}
      </div>
    );
  }
);

const COLORS = {
  client: "#ccc",
  trigger: "#41FF54",
  llm: "#ad46ff",
  db: "#34D59A",
  ably: "#FF5115",
};

const STEP_DURATION = 2;
const TOTAL_CYCLE = 14;
const REPEAT_DELAY = TOTAL_CYCLE - STEP_DURATION;

Circle.displayName = "Circle";
// TODO
export function HowItWorksSection() {
  const containerRef = useRef<HTMLDivElement>(null);
  const clientRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const llmRef = useRef<HTMLDivElement>(null);
  const dbRef = useRef<HTMLDivElement>(null);
  const ablyRef = useRef<HTMLDivElement>(null);

  const isInView = useInView(containerRef, { once: true, margin: "-200px" });

  const PATHS: PathTypes[] = [
    {
      name: "req",
      containerRef: containerRef,
      fromRef: clientRef,
      toRef: triggerRef,
      gradientStartColor: COLORS.trigger,
      gradientStopColor: COLORS.client,
      delay: 0,
    },
    {
      name: "ai-req",
      containerRef: containerRef,
      fromRef: triggerRef,
      toRef: llmRef,
      gradientStartColor: COLORS.llm,
      gradientStopColor: COLORS.trigger,
      delay: STEP_DURATION,
    },
    {
      name: "ai-res",
      containerRef: containerRef,
      fromRef: llmRef,
      toRef: triggerRef,
      gradientStartColor: COLORS.trigger,
      gradientStopColor: COLORS.llm,
      reverse: true,
      delay: STEP_DURATION * 2,
    },
    {
      name: "db-save",
      containerRef: containerRef,
      fromRef: triggerRef,
      toRef: dbRef,
      gradientStartColor: COLORS.db,
      gradientStopColor: COLORS.trigger,
      delay: STEP_DURATION * 3,
    },
    {
      name: "realtime-push",
      containerRef: containerRef,
      fromRef: triggerRef,
      toRef: ablyRef,
      gradientStartColor: COLORS.ably,
      gradientStopColor: COLORS.trigger,
      delay: STEP_DURATION * 4,
    },
    {
      name: "notify-client",
      containerRef: containerRef,
      fromRef: ablyRef,
      toRef: clientRef,
      gradientStartColor: COLORS.client,
      gradientStopColor: COLORS.ably,
      delay: STEP_DURATION * 5,
      reverse: true,
    },
  ];

  return (
    <section className="mx-auto flex w-full max-w-7xl flex-col items-center justify-center overflow-hidden px-4 py-24">
      <div className="mb-12 text-center">
        <h2 className="mb-4 text-3xl font-bold md:text-5xl">
          Under the <span className="text-muted-foreground">Hood</span>
        </h2>
        <p className="text-muted-foreground text-lg">
          We handle the heavy lifting asynchronously. You just get the result instantly.
        </p>
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
              You (Client)
            </span>
          </div>
        </div>

        <div className="flex h-full flex-col justify-center px-8 md:px-0">
          <div className="flex flex-col items-center gap-3">
            <Circle ref={triggerRef} className="size-16 border-[#41FF54]/40 sm:size-24">
              <TriggerIcon />
            </Circle>
            <div className="flex flex-col items-center">
              <span className="text-muted-foreground text-xs sm:text-sm">Orchestrator</span>
            </div>
          </div>
        </div>

        <div className="flex h-full flex-col justify-between gap-8">
          <div className="flex flex-col items-center gap-2">
            <Circle ref={llmRef} className="border-purple-500/40">
              <Brain className="text-purple-500" />
            </Circle>
            <span className="text-muted-foreground text-xs sm:text-sm">AI Processing</span>
          </div>

          <div className="flex flex-col items-center gap-2">
            <Circle ref={dbRef} className="border-[#34D59A]/40">
              <NeonIcon />
            </Circle>
            <span className="text-muted-foreground text-xs sm:text-sm">Neon DB</span>
          </div>

          <div className="flex flex-col items-center gap-2">
            <Circle ref={ablyRef} className="border-[#FF5115]/40">
              <AblyIcon />
            </Circle>
            <span className="text-muted-foreground text-xs sm:text-sm">Ably Realtime</span>
          </div>
        </div>
        {PATHS.map((path) => (
          <AnimatedBeam
            key={path.name}
            containerRef={containerRef}
            fromRef={path.fromRef}
            toRef={path.toRef}
            gradientStartColor={path.gradientStartColor}
            gradientStopColor={path.gradientStopColor}
            curvature={path.curvature}
            reverse={path.reverse}
            duration={STEP_DURATION}
            delay={path.delay}
            repeatDelay={REPEAT_DELAY}
            isActive={isInView}
          />
        ))}
      </div>
      <div className="bg-background/50 mt-8 flex items-center gap-2 rounded-full border px-4 py-1 backdrop-blur-sm">
        <FileText className="text-success h-4 w-4" />
        <span className="text-muted-foreground text-xs">
          Documentation is generated automatically in background
        </span>
      </div>
    </section>
  );
}
