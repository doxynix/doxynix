import { getTranslations } from "next-intl/server";

import { Logo } from "@/shared/ui/branding/doxynix-logo";
import { ScrollButton } from "@/shared/ui/kit/scroll-button";
import { AnimatedShinyText } from "@/shared/ui/visuals/animated-shiny-text";
import { ShimmerButton } from "@/shared/ui/visuals/shimmer-button";
import { TextAnimate } from "@/shared/ui/visuals/text-animate";

export async function HeroSection() {
  const t = await getTranslations("Landing");

  return (
    <section className="flex min-h-dvh flex-col items-center justify-center p-4 pt-16" id="hero">
      <div className="flex h-full max-w-4xl flex-col items-center justify-between gap-6 text-center">
        <Logo className="mb-8 max-h-150 max-w-150 animate-fade-in" isInteractive={false} />
        <div className="glass-panel flex items-center justify-center rounded-full border border-border bg-landing-bg-dark/56 px-3 py-1">
          <AnimatedShinyText className="inline-flex items-center justify-center bg-linear-to-r from-transparent via-50% via-primary-foreground/95 to-transparent px-4 py-1 transition-standard">
            <span className="text-sm">{t("section_hero_badge")}</span>
          </AnimatedShinyText>
        </div>

        <TextAnimate
          animation="blurIn"
          as="h1"
          className="not-md:hidden font-bold text-4xl tracking-tighter sm:text-5xl md:text-7xl lg:text-8xl"
          duration={1}
          startOnView={false}
        >
          {t("section_hero_title")}
        </TextAnimate>

        <TextAnimate
          animation="slideRight"
          as="p"
          className="not-md:hidden max-w-xl text-base text-muted-foreground sm:text-lg md:text-xl"
          duration={1}
          startOnView={false}
        >
          {t("section_hero_desc")}
        </TextAnimate>

        <h1 className="fade-in slide-in-from-left-2 animate-in font-bold text-4xl tracking-tighter duration-200 sm:text-5xl md:hidden md:text-7xl lg:text-8xl">
          {t("section_hero_title")}
        </h1>

        <p className="fade-in slide-in-from-left-2 max-w-xl animate-in text-base text-muted-foreground duration-200 sm:text-lg md:hidden md:text-xl">
          {t("section_hero_desc")}
        </p>

        <div className="flex gap-4">
          <ShimmerButton className="animate-fade-in p-6" href="/auth">
            <span className="font-medium text-sm lg:text-lg">{t("section_hero_btn")}</span>
          </ShimmerButton>
        </div>
        <ScrollButton
          ariaLabel="Scroll to brands section"
          arrowClassName="rotate-90"
          buttonClassName="animate-float"
          offset={0}
          targetId="brands"
        />
      </div>
    </section>
  );
}
