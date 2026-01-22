import { ScrollButton } from "@/shared/ui/kit/scroll-button";
import { BackgroundBeamsWithCollision } from "@/shared/ui/visuals/background-beams-with-collision";
import { ShimmerButton } from "@/shared/ui/visuals/shimmer-button";

export function CTASection() {
  return (
    <section className="relative container mx-auto flex w-full flex-col items-center justify-center overflow-hidden">
      <BackgroundBeamsWithCollision className="h-full py-24">
        <div className="flex flex-col items-center justify-center gap-6 px-4 text-center">
          <h2 className="text-4xl font-bold tracking-tight md:text-6xl">
            Ready to document <br /> your legacy?
          </h2>
          <p className="text-muted-foreground mx-auto">Start using Doxynix today</p>
          <ShimmerButton className="h-12 px-8 text-lg" href="/auth">
            <span className="text-sm font-medium lg:text-lg">Try for Free</span>
          </ShimmerButton>
        </div>
      </BackgroundBeamsWithCollision>
      <ScrollButton
        targetId="hero"
        arrowClassName="-rotate-90"
        buttonClassName="animate-float absolute bottom-0"
      />
    </section>
  );
}
