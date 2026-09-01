import { Suspense } from "react";
import { getTranslations } from "next-intl/server";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/core/card";

import { AnalyticsChart } from "./analytics-chart";
import { AnalyticsChartSkeleton } from "./analytics-chart-skeleton";

export async function AnalyticsSection() {
  const t = await getTranslations("Landing");

  return (
    <section className="container relative mx-auto px-4 py-24">
      <div className="mb-12 text-center">
        <h2 className="font-bold text-3xl md:text-5xl">
          {t("section_analytics_title_prefix")}{" "}
          <span className="text-muted-foreground">{t("section_analytics_title_highlight")}</span>
        </h2>
        <p className="mt-4 text-lg text-muted-foreground">{t("section_analytics_subtitle")}</p>
      </div>

      <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
        <Card className="col-span-1 bg-landing-bg-light/50 md:col-span-2">
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
          <Card className="flex flex-1 flex-col justify-center bg-landing-bg-light/50 p-6">
            <p className="text-muted-foreground text-sm uppercase tracking-widest">
              {t("section_analytics_bus_factor")}
            </p>
            <span className="mt-2 font-bold text-5xl text-destructive">1.2</span>
            <p className="mt-2 text-muted-foreground text-xs">{t("section_analytics_review")}</p>
          </Card>
          <Card className="flex flex-1 flex-col justify-center bg-landing-bg-light/50 p-6">
            <p className="text-muted-foreground text-sm uppercase tracking-widest">
              {t("section_analytics_maintain")}
            </p>
            <span className="mt-2 font-bold text-5xl text-success">A+</span>
            <div className="mt-2 text-muted-foreground text-xs">
              {t("section_analytics_improve")}
            </div>
          </Card>
        </div>
      </div>
    </section>
  );
}
