import { ReactNode } from "react";
import { Activity, Database, FileText, Globe, Lock, Terminal } from "lucide-react";

import { BentoCard, BentoGrid } from "@/shared/ui/visuals/bento-grid";
import { BorderBeam } from "@/shared/ui/visuals/border-beam";

interface BentoFeature {
  name: string;
  className: string;
  background: ReactNode;
  Icon: typeof Activity;
  description: string;
  href: string;
  cta: string;
}

const FEATURES: BentoFeature[] = [
  {
    name: "Project Health",
    className: "lg:col-span-1 lg:row-span-3",
    background: (
      <div className="absolute inset-0 flex items-center justify-center opacity-50">
        <Globe className="animate-spin-slow h-64 w-64 text-zinc-800" />
      </div>
    ),
    Icon: Activity,
    description:
      "Hybrid engine combines LLM reasoning with AST precision. Generates both high-level summaries and line-by-line technical specs.",
    href: "/",
    cta: "Learn more",
  },
  {
    name: "Deep Analysis",
    className: "lg:col-span-1 lg:row-span-3",
    background: (
      <div className="absolute inset-0 flex items-center justify-center opacity-50">
        <Globe className="animate-spin-slow h-64 w-64 text-zinc-800" />
      </div>
    ),
    Icon: Database,
    description:
      "Hybrid engine combines LLM reasoning with AST precision. Generates both high-level summaries and line-by-line technical specs.",
    href: "/",
    cta: "Learn more",
  },
  {
    name: "CLI First",
    className: "lg:col-span-2 lg:row-span-1",
    background: (
      <div className="text-success bg-landing-bg-light absolute inset-0 overflow-hidden p-4 font-mono text-xs opacity-80">
        <p>$ npx doxynix init</p>
        <p className="text-muted-foreground">Analyzing src/app/page.tsx...</p>
        <p className="text-muted-foreground">Generating docs...</p>
        <p>Done in 1.2s ✨</p>
      </div>
    ),
    Icon: Terminal,
    description: "CI/CD Pipeline integration. Generate documentation automatically on every push.",
    href: "/",
    cta: "Install",
  },
  {
    name: "Enterprise Security",
    className: "lg:col-span-1 lg:row-span-2",
    background: (
      <div className="flex h-full w-full items-center justify-center">
        <BorderBeam size={250} duration={12} delay={9} />
      </div>
    ),
    Icon: Lock,
    description: "Your code is never used for model training. SOC2 Compliant infrastructure.",
    href: "/",
    cta: "Security",
  },
  {
    name: "Multi-format Export",
    className: "lg:col-span-1 lg:row-span-2",
    background: <div className="bg-landing-bg-light/20 absolute inset-0" />,
    Icon: FileText,
    description: "Export to Markdown, PDF, Notion, or deploy as a static HTML site.",
    href: "/",
    cta: "See Examples",
  },
];

export function FeaturesSection() {
  return (
    <section className="relative z-10 container mx-auto px-4 py-32">
      <h2 className="mb-16 text-center text-3xl font-bold md:text-5xl">
        The Complete <br /> <span className="text-muted-foreground">Toolkit</span>
      </h2>
      <BentoGrid className="lg:grid-rows-3">
        {FEATURES.map((item) => (
          <BentoCard key={item.name} {...item} />
        ))}
      </BentoGrid>
    </section>
  );
}
