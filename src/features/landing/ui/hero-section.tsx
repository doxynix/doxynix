"use client";

import { MoveRight } from "lucide-react";

import { smoothScrollTo } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/core/button";
import { Logo } from "@/shared/ui/icons/logo";
import { AnimatedShinyText } from "@/shared/ui/visuals/animated-shiny-text";
import { ShimmerButton } from "@/shared/ui/visuals/shimmer-button";
import { TextAnimate } from "@/shared/ui/visuals/text-animate";

export function HeroSection() {
  return (
    <section className="relative z-10 flex min-h-screen flex-col items-center justify-center p-20">
      {/* <Spotlight className="fill-primary fixed -top-75 transform opacity-100" /> */}
      {/* <Spotlight className="fill-primary fixed -top-75 -rotate-70 transform opacity-100" /> */}

      <Logo isInteractive={false} className="mb-8 max-h-150 max-w-150" />

      <div className="flex max-w-4xl flex-col items-center justify-between gap-6 text-center">
        <div className="border-primary bg-landing-bg-dark/50 flex items-center justify-center rounded-full border px-3 py-1 backdrop-blur-sm">
          <AnimatedShinyText className="inline-flex items-center justify-center px-4 py-1 transition ease-out">
            <span className="text-sm">Powered by Advanced AI & AST Engine</span>
          </AnimatedShinyText>
        </div>

        <TextAnimate
          as="h1"
          startOnView={false}
          duration={1}
          animation="blurIn"
          className="text-5xl font-bold tracking-tighter md:text-7xl lg:text-8xl"
        >
          Turn Code into Documentation
        </TextAnimate>

        <TextAnimate
          duration={1}
          as="p"
          startOnView={false}
          animation="slideRight"
          className="text-muted-foreground max-w-xl text-lg md:text-xl"
        >
          Generate Onboarding Guides, Architecture Maps, and Live Metrics. Turn your legacy code
          into a clear knowledge base instantly.
        </TextAnimate>

        <div className="mt-8 flex gap-4">
          <ShimmerButton className="p-6 shadow-2xl">
            <span className="from-white to-slate-900/10 text-center text-sm leading-none font-medium tracking-tight whitespace-pre-wrap lg:text-lg">
              Get Started Free
            </span>
          </ShimmerButton>
        </div>
        <Button
          onClick={() => {
            smoothScrollTo("brands");
          }}
          className="mt-16 animate-bounce"
          variant="ghost"
        >
          <MoveRight size={12} className="rotate-90" />
        </Button>
      </div>
    </section>
  );
}
