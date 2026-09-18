import { createMetadata } from "@/shared/lib/metadata";

import { AnalyticsSection } from "@/widgets/landing/ui/analytics-section";
import { BrandsSection } from "@/widgets/landing/ui/brands-section";
import { CodeComparisonSection } from "@/widgets/landing/ui/code-comparison-section";
import { ConfigSection } from "@/widgets/landing/ui/config-section";
import { CTASection } from "@/widgets/landing/ui/cta-section";
import { DocModesSection } from "@/widgets/landing/ui/doc-modes-section";
import { FAQSection } from "@/widgets/landing/ui/faq-section";
import { FeaturesSection } from "@/widgets/landing/ui/features-section";
import { HeroSection } from "@/widgets/landing/ui/hero-section";
import { HowItWorksSection } from "@/widgets/landing/ui/how-it-works-section";
import { PricingSection } from "@/widgets/landing/ui/pricing-section";

export const generateMetadata = createMetadata("landing_title", "landing_desc");

export default async function LandingPage() {
  return (
    <>
      <HeroSection />
      <BrandsSection />
      <CodeComparisonSection />
      <HowItWorksSection />
      <FeaturesSection />
      <AnalyticsSection />
      <DocModesSection />
      <ConfigSection />
      {/* NOTE: Social proof (someday a marquee could run in both directions like BrandsSection, except only one there and two can be made here) */}
      {/* <TestimonialsSection /> */}
      <PricingSection />
      <FAQSection />
      <CTASection />
    </>
  );
}
