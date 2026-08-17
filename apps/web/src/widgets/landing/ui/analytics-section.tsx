import { Suspense } from "react";
import { getTranslations } from "next-intl/server";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/core/card";

import { AnalyticsChart } from "./analytics-chart";
import { AnalyticsChartSkeleton } from "./analytics-chart-skeleton";

export async function AnalyticsSection() {
  const t = await getTranslations("Landing");

  return (
    <section className="relative container mx-auto px-4 py-24">
      <div className="mb-12 text-center">
        <h2 className="text-3xl font-bold md:text-5xl">
          {t("section_analytics_title_prefix")}{" "}
          <span className="text-muted-foreground">{t("section_analytics_title_highlight")}</span>
        </h2>
        <p className="text-muted-foreground mt-4 text-lg">{t("section_analytics_subtitle")}</p>
      </div>

      <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
        <Card className="bg-landing-bg-light/50 col-span-1 md:col-span-2">
          <CardHeader>
            <CardTitle>{t("section_analytics_card_title")}</CardTitle>
            <CardDescription>{t("section_analytics_card_desc")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Suspense fallback={<AnalyticsChartSkeleton />}>
              <AnalyticsChart />
            </Suspense>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4">
          <Card className="bg-landing-bg-light/50 flex flex-1 flex-col justify-center p-6">
            <p className="text-muted-foreground text-sm tracking-widest uppercase">
              {t("section_analytics_bus_factor")}
            </p>
            <span className="text-destructive mt-2 text-5xl font-bold">1.2</span>
            <p className="text-muted-foreground mt-2 text-xs">{t("section_analytics_review")}</p>
          </Card>
          <Card className="bg-landing-bg-light/50 flex flex-1 flex-col justify-center p-6">
            <p className="text-muted-foreground text-sm tracking-widest uppercase">
              {t("section_analytics_maintain")}
            </p>
            <span className="text-success mt-2 text-5xl font-bold">A+</span>
            <div className="text-muted-foreground mt-2 text-xs">
              {t("section_analytics_improve")}
            </div>
          </Card>
        </div>
      </div>
    </section>
  );
}
