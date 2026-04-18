"use client";

import React, { forwardRef, useRef } from "react";
import { Brain, FileText, User } from "lucide-react";
import { useInView } from "motion/react";
import { useTranslations } from "next-intl";

import { cn } from "@/shared/lib/cn";
import { Badge } from "@/shared/ui/core/badge";
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

type NodeType = {
  circleClass?: string;
  gapClass?: string;
  icon: React.ReactNode;
  label: string;
  labelClass?: string;
  ref: React.RefObject<HTMLDivElement | null>;
};

type ColumnTypes = {
  className: string;
  nodes: NodeType[];
};

const Circle = forwardRef<HTMLDivElement, { children?: React.ReactNode; className?: string }>(
  ({ children, className }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "border-border bg-landing-bg-light flex size-12 items-center justify-center rounded-full border-2 p-3 sm:size-20",
          className
        )}
      >
        {children}
      </div>
    );
  }
);

const COLORS = {
  ably: "var(--brand-ably)",
  client: "var(--brand-client)",
  db: "var(--brand-db)",
  llm: "var(--brand-ai)",
  trigger: "var(--brand-trigger)",
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

  const COLUMNS: ColumnTypes[] = [
    {
      className: "flex h-full flex-col justify-center",
      nodes: [
        {
          circleClass: "border-border-strong",
          gapClass: "gap-3",
          icon: <User />,
          label: t("section_how_node_client"),
          labelClass: "font-bold",
          ref: clientRef,
        },
      ],
    },
    {
      className: "flex h-full flex-col justify-center px-8 md:px-0",
      nodes: [
        {
          circleClass: "border-brand-trigger/40 size-16 sm:size-24",
          gapClass: "gap-3",
          icon: <TriggerIcon />,
          label: t("section_how_node_orchestrator"),
          ref: triggerRef,
        },
      ],
    },
    {
      className: "flex h-full flex-col justify-between gap-8",
      nodes: [
        {
          circleClass: "border-brand-ai/40",
          gapClass: "gap-2",
          icon: <Brain className="text-brand-ai" />,
          label: t("section_how_node_ai"),
          ref: llmRef,
        },
        {
          circleClass: "border-brand-db/40",
          gapClass: "gap-2",
          icon: <NeonIcon />,
          label: t("section_how_node_db"),
          ref: dbRef,
        },
        {
          circleClass: "border-brand-ably/40",
          gapClass: "gap-2",
          icon: <AblyIcon />,
          label: t("section_how_node_ably"),
          ref: ablyRef,
        },
      ],
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
        {COLUMNS.map((col, idx) => (
          <div key={idx} className={col.className}>
            {col.nodes.map((node, nodeIdx) => (
              <div key={nodeIdx} className={cn("flex flex-col items-center", node.gapClass)}>
                <Circle ref={node.ref} className={node.circleClass}>
                  {node.icon}
                </Circle>
                <span className={cn("text-muted-foreground text-xs sm:text-sm", node.labelClass)}>
                  {node.label}
                </span>
              </div>
            ))}
          </div>
        ))}

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
            className="-z-10"
          />
        ))}
      </div>
      <Badge variant="outline" className="px-4 py-1">
        <FileText className="text-success" />
        <span className="text-muted-foreground text-xs">{t("section_how_status_msg")}</span>
      </Badge>
    </section>
  );
}
