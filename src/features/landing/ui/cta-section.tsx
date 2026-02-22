import { useTranslations } from "next-intl";

import { ScrollButton } from "@/shared/ui/kit/scroll-button";
import { BackgroundBeamsWithCollision } from "@/shared/ui/visuals/background-beams-with-collision";
import { ShimmerButton } from "@/shared/ui/visuals/shimmer-button";

export function CTASection() {
  const t = useTranslations("Landing");

  return (
    <section className="relative container mx-auto flex w-full flex-col items-center justify-center overflow-hidden">
      <BackgroundBeamsWithCollision className="h-full py-24">
        <div className="flex flex-col items-center justify-center gap-6 px-4 text-center">
          <h2 className="text-4xl font-bold tracking-tight md:text-6xl">
            {t("section_cta_title_1")} <br /> {t("section_cta_title_2")}
          </h2>
          <p className="text-muted-foreground mx-auto">{t("section_cta_desc")}</p>
          <ShimmerButton href="/auth" className="h-12 px-8 text-lg">
            <span className="text-sm font-medium lg:text-lg">{t("section_cta_btn")}</span>
          </ShimmerButton>
        </div>
      </BackgroundBeamsWithCollision>
      <ScrollButton
        arrowClassName="-rotate-90"
        buttonClassName="animate-float absolute bottom-0"
        targetId="hero"
      />
    </section>
  );
}
