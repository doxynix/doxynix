import { BackgroundBeamsWithCollision } from "@/shared/ui/visuals/background-beams-with-collision";
import { ShimmerButton } from "@/shared/ui/visuals/shimmer-button";

export function CTASection() {
  return (
    <section className="relative z-10 container mx-auto flex w-full flex-col items-center justify-center overflow-hidden">
      <BackgroundBeamsWithCollision className="h-full">
        <div className="relative flex flex-col items-center justify-center gap-6 px-4 text-center">
          <h2 className="text-4xl font-bold tracking-tight md:text-6xl">
            Ready to document <br /> your legacy?
          </h2>
          <p className="text-muted-foreground mx-auto">Start using Doxynix today</p>
          <ShimmerButton className="h-12 px-8 text-lg">Try for Free</ShimmerButton>
        </div>
      </BackgroundBeamsWithCollision>
    </section>
  );
}
