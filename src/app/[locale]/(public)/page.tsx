import { createMetadata } from "@/shared/lib/metadata";

import { AnalyticsSection } from "@/features/landing/ui/analytics-section";
import { BrandsSection } from "@/features/landing/ui/brands-section";
import { CodeComparisonSection } from "@/features/landing/ui/code-comparison-section";
import { ConfigSection } from "@/features/landing/ui/config-section";
import { CTASection } from "@/features/landing/ui/cta-section";
import { DocModesSection } from "@/features/landing/ui/doc-modes-section";
import { FAQSection } from "@/features/landing/ui/faq-section";
import { FeaturesSection } from "@/features/landing/ui/features-section";
import { HeroSection } from "@/features/landing/ui/hero-section";
import { HowItWorksSection } from "@/features/landing/ui/how-it-works-section";
import { PricingSection } from "@/features/landing/ui/pricing-section";

// export const runtime = "edge";

export const generateMetadata = createMetadata("landing_title", "landing_desc");

export default async function LandingPage() {
  return (
    <>
      {/* <Particles className="fixed inset-0 h-full w-full" /> */}
      <HeroSection />
      <BrandsSection />
      <CodeComparisonSection />
      <HowItWorksSection />
      <FeaturesSection />
      <AnalyticsSection />
      <DocModesSection />
      <ConfigSection />
      {/* ОБЯЗАТЕЛЬНО: Социальное доказательство (когда-нибудь можно marquee пустить в 2 стороны примерно как у BrandsSection только там одно а тут можно и 2 сделать) */}
      {/* <TestimonialsSection /> */}
      <PricingSection />
      <FAQSection />
      <CTASection />
    </>
  );
}
