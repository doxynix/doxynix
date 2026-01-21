"use client";

import React, { forwardRef, useRef } from "react";
import { BookCheck, Brain, User } from "lucide-react";

import { cn } from "@/shared/lib/utils";
import { AblyIcon } from "@/shared/ui/icons/ably-icon";
import { NeonIcon } from "@/shared/ui/icons/neon-icon";
import { TriggerIcon } from "@/shared/ui/icons/trigger-icon";
import { AnimatedBeam } from "@/shared/ui/visuals/animated-beam";

const Circle = forwardRef<HTMLDivElement, { className?: string; children?: React.ReactNode }>(
  ({ className, children }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "border-border dark:bg-landing-bg-light z-10 flex size-20 items-center justify-center rounded-full border-2 bg-white p-3 shadow-[0_0_20px_-12px_rgba(0,0,0,0.8)]",
          className
        )}
      >
        {children}
      </div>
    );
  }
);

Circle.displayName = "Circle";
// TODO
export function HowItWorksSection() {
  const containerRef = useRef<HTMLDivElement>(null);
  const div1Ref = useRef<HTMLDivElement>(null); // User
  const div2Ref = useRef<HTMLDivElement>(null); // Trigger.dev
  const div3Ref = useRef<HTMLDivElement>(null); // LLM
  const div4Ref = useRef<HTMLDivElement>(null); // Neon
  const div5Ref = useRef<HTMLDivElement>(null); // Ably
  const div6Ref = useRef<HTMLDivElement>(null); // Result

  return (
    <section className="relative z-10 flex w-full flex-col items-center justify-center overflow-hidden py-24">
      <div className="mb-12 text-center">
        <h2 className="mb-4 text-3xl font-bold md:text-5xl">
          Under the <span className="text-muted-foreground">Hood</span>
        </h2>
        <p className="text-muted-foreground">Event-driven architecture powered by modern stack</p>
      </div>

      <div
        ref={containerRef}
        className="relative flex h-125 w-full items-center justify-center overflow-hidden p-10"
      >
        <div className="flex size-full max-w-4xl flex-row items-stretch justify-between gap-10">
          <div className="flex flex-col justify-center">
            <div className="flex flex-col items-center gap-2">
              <Circle ref={div1Ref}>
                <User />
              </Circle>
              <span className="text-muted-foreground text-[10px] font-bold uppercase">Client</span>
            </div>
          </div>

          <div className="flex flex-col justify-center">
            <div className="flex flex-col items-center gap-2">
              <Circle ref={div2Ref} className="size-24 border-blue-500/50 shadow-blue-500/20">
                <TriggerIcon />
              </Circle>
              <span className="text-[10px] font-bold tracking-widest text-blue-500 uppercase">
                Orchestrator
              </span>
            </div>
          </div>

          <div className="flex flex-col justify-between py-4">
            <div className="flex flex-col items-center gap-2">
              <Circle ref={div3Ref}>
                <Brain className="text-purple-500" />
              </Circle>
              <span className="text-muted-foreground text-[10px]">AI Analysis</span>
            </div>

            <div className="flex flex-col items-center gap-2">
              <Circle ref={div4Ref}>
                <NeonIcon />
              </Circle>
              <span className="text-muted-foreground text-[10px]">Database</span>
            </div>

            <div className="flex flex-col items-center gap-2">
              <Circle ref={div5Ref}>
                <AblyIcon />
              </Circle>
              <span className="text-muted-foreground text-[10px]">Real-time update</span>
            </div>

            <div className="flex flex-col items-center gap-2">
              <Circle ref={div1Ref} className="border-green-500/50 bg-green-500/5">
                <BookCheck className="text-green-500" />
              </Circle>
              <span className="text-[10px] font-bold text-green-500 italic">Result</span>
            </div>
          </div>
        </div>

        <AnimatedBeam
          gradientStartColor="#fff"
          gradientStopColor="#fff"
          containerRef={containerRef}
          fromRef={div6Ref}
          toRef={div2Ref}
          duration={3}
        />

        <AnimatedBeam
          containerRef={containerRef}
          fromRef={div2Ref}
          gradientStartColor="#fff"
          gradientStopColor="#fff"
          toRef={div3Ref}
          duration={3}
          curvature={-20}
        />

        <AnimatedBeam
          gradientStartColor="#fff"
          gradientStopColor="#fff"
          containerRef={containerRef}
          fromRef={div2Ref}
          toRef={div4Ref}
          duration={3}
        />

        <AnimatedBeam
          gradientStartColor="#fff"
          gradientStopColor="#fff"
          containerRef={containerRef}
          fromRef={div2Ref}
          toRef={div5Ref}
          duration={3}
          curvature={20}
        />

        <AnimatedBeam
          gradientStartColor="#fff"
          gradientStopColor="#fff"
          containerRef={containerRef}
          fromRef={div5Ref}
          toRef={div1Ref}
          duration={3}
        />
        <AnimatedBeam
          gradientStartColor="#fff"
          gradientStopColor="#fff"
          containerRef={containerRef}
          fromRef={div1Ref}
          toRef={div6Ref}
          reverse
          duration={3}
        />
      </div>
    </section>
  );
}
