import { ReactNode } from "react";
import { Activity, Code2, Cpu, FileJson, Lock, Share2, Terminal } from "lucide-react";
import { useTranslations } from "next-intl";

import { BentoCard, BentoGrid } from "@/shared/ui/visuals/bento-grid";

import { SimulationTerminal } from "./simulation-terminal";

interface BentoFeature {
  name: string;
  className: string;
  background: ReactNode;
  Icon: typeof Activity;
  description: string;
  href: string;
  cta: string;
}

const MockGraph = () => (
  <div className="absolute inset-x-4 bottom-0 flex h-60 items-end justify-between gap-1 opacity-50 sm:h-120">
    {[40, 70, 50, 80, 60, 90, 75, 40, 70, 50, 80, 60].map((h, i) => (
      <div
        key={i}
        className="w-full rounded-t bg-linear-to-t from-zinc-800 to-zinc-500/20 transition-all duration-500 hover:to-zinc-500/50"
        style={{ height: `${h}%` }}
      />
    ))}
  </div>
);

export function FeaturesSection() {
  const t = useTranslations("Landing");

  const FEATURES: BentoFeature[] = [
    {
      name: t("section_features_cli_name"),
      className: "lg:col-span-2 lg:row-span-2",
      background: (
        <div className="absolute inset-0 flex items-center justify-center p-4 pt-10 sm:p-8 sm:pt-14">
          <SimulationTerminal />
        </div>
      ),
      Icon: Terminal,
      description: t("section_features_cli_desc"),
      href: "/docs/cli",
      cta: t("section_features_cli_cta"),
    },
    {
      name: t("section_features_health_name"),
      className: "lg:col-span-1 lg:row-span-2",
      background: (
        <div className="itemend flex flex-col justify-end overflow-hidden p-8 text-right">
          <div className="top-10 right-10 text-4xl font-bold">98%</div>
          <div className="text-muted-foreground top-20 right-10 text-xs">
            {" "}
            {t("section_features_health_score_label")}
          </div>
          <MockGraph />
        </div>
      ),
      Icon: Activity,
      description: t("section_features_health_desc"),
      href: "/features/analytics",
      cta: t("section_features_health_cta"),
    },
    {
      name: t("section_features_ast_name"),
      className: "lg:col-span-1 lg:row-span-1",
      background: (
        <div className="flex justify-end p-4 text-right opacity-30 transition-opacity group-hover:opacity-50">
          <Code2 className="text-muted-foreground h-24 w-24 -rotate-12" />
        </div>
      ),
      Icon: Cpu,
      description: t("section_features_ast_desc"),
      href: "/features/engine",
      cta: t("section_features_ast_cta"),
    },
    {
      name: t("section_features_security_name"),
      className: "lg:col-span-1 lg:row-span-1",
      background: (
        <div className="flex justify-end p-4 text-right opacity-30 transition-opacity group-hover:opacity-50">
          <Lock className="text-muted-foreground h-24 w-24 -rotate-12" />
        </div>
      ),
      Icon: Lock,
      description: t("section_features_security_desc"),
      href: "/security",
      cta: t("section_features_security_cta"),
    },
    {
      name: t("section_features_export_name"),
      className: "lg:col-span-1 lg:row-span-1",
      background: (
        <div className="flex justify-end p-4 text-right opacity-30 transition-opacity group-hover:opacity-50">
          <FileJson className="text-muted-foreground h-24 w-24 -rotate-12" />
        </div>
      ),
      Icon: Share2,
      description: t("section_features_export_desc"),
      href: "/features/exports",
      cta: t("section_features_export_cta"),
    },
  ];

  return (
    <section className="container mx-auto px-4 py-32">
      <h2 className="mb-4 text-center text-3xl font-bold md:text-5xl">
        {t("section_features_title_prefix")}{" "}
        <span className="text-muted-foreground">{t("section_features_title_highlight")}</span>
      </h2>
      <p className="text-muted-foreground mx-auto mb-16 max-w-2xl text-center text-lg">
        {t("section_features_desc")}
      </p>

      <BentoGrid className="lg:grid-rows-3">
        {FEATURES.map((item) => (
          <BentoCard key={item.name} {...item} />
        ))}
      </BentoGrid>
    </section>
  );
}
