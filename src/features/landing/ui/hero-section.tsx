import { useTranslations } from "next-intl";

import { Logo } from "@/shared/ui/icons/logo";
import { ScrollButton } from "@/shared/ui/kit/scroll-button";
import { AnimatedShinyText } from "@/shared/ui/visuals/animated-shiny-text";
import { ShimmerButton } from "@/shared/ui/visuals/shimmer-button";
import { TextAnimate } from "@/shared/ui/visuals/text-animate";

export function HeroSection() {
  const t = useTranslations("Landing");

  return (
    <section className="flex min-h-dvh flex-col items-center justify-center p-4 pt-16" id="hero">
      {/* <Spotlight className="fill-primary fixed -top-75 transform opacity-100" /> */}
      {/* <Spotlight className="fill-primary fixed -top-75 -rotate-70 transform opacity-100" /> */}

      <div className="flex h-full max-w-4xl flex-col items-center justify-between gap-6 text-center">
        <Logo isInteractive={false} className="animate-fade-in mb-8 max-h-150 max-w-150" />
        <div className="border-primary bg-landing-bg-dark/50 flex items-center justify-center rounded-full border px-3 py-1 backdrop-blur-sm">
          <AnimatedShinyText className="inline-flex items-center justify-center px-4 py-1 transition ease-out">
            <span className="text-sm">{t("section_hero_badge")}</span>
          </AnimatedShinyText>
        </div>

        <TextAnimate
          as="h1"
          startOnView={false}
          duration={1}
          animation="blurIn"
          className="text-4xl font-bold tracking-tighter not-md:hidden sm:text-5xl md:text-7xl lg:text-8xl"
        >
          {t("section_hero_title")}
        </TextAnimate>

        <TextAnimate
          duration={1}
          as="p"
          startOnView={false}
          animation="slideRight"
          className="text-muted-foreground max-w-xl text-base not-md:hidden sm:text-lg md:text-xl"
        >
          {t("section_hero_desc")}
        </TextAnimate>

        <h1 className="animate-in fade-in slide-in-from-left-2 text-4xl font-bold tracking-tighter duration-300 sm:text-5xl md:hidden md:text-7xl lg:text-8xl">
          {t("section_hero_title")}
        </h1>

        <p className="text-muted-foreground animate-in fade-in slide-in-from-left-2 max-w-xl text-base duration-300 sm:text-lg md:hidden md:text-xl">
          {t("section_hero_desc")}
        </p>

        <div className="flex gap-4">
          <ShimmerButton href="/auth" className="animate-fade-in p-6">
            <span className="text-sm font-medium lg:text-lg">{t("section_hero_btn")}</span>
          </ShimmerButton>
        </div>
        <ScrollButton
          targetId="brands"
          arrowClassName="rotate-90"
          offset={0}
          buttonClassName="animate-float"
        />
      </div>
    </section>
  );
}
