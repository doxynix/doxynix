import type { Metadata } from "next";

import { Particles } from "@/shared/ui/particles";
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
  title: "Turn Code into Documentation",
  description: "AI-powered documentation generator for modern engineering teams.",
};

export default async function LandingPage() {
  return (
    <div className="bg-landing-bg-dark relative min-h-screen w-full overflow-hidden">
      <Particles className="fixed inset-0 h-full w-full" />
      <HeroSection />
      <BrandsSection />
      <HowItWorksSection />
      <FeaturesSection />
      <AnalyticsSection />
      <CodeComparisonSection />
      <DocModesSection />
      <ConfigSection />
      <PricingSection />
      <FAQSection />
      <CTASection />
    </div>
  );
}
