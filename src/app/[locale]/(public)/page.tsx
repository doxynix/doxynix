import { createMetadata } from "@/shared/lib/metadata";
import {
  AnalyticsSection,
  BrandsSection,
  CodeComparisonSection,
  ConfigSection,
  CTASection,
  DocModesSection,
  FAQSection,
  FeaturesSection,
  HeroSection,
  HowItWorksSection,
  PricingSection,
} from "@/features/landing";

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
