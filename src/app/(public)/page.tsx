import type { Metadata } from "next";

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

export const metadata: Metadata = {
  title: "Turn Code into Documentation - AI Analysis Tool",
  description:
    "Automate technical documentation for your engineering team. Doxynix analyzes legacy code, generates architecture maps, and tracks complexity metrics in real-time.",
};

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
