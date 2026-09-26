"use client";

import type { ComponentType } from "react";
import { Book, ChartNoAxesColumn } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { useRouter } from "@/shared/i18n/navigation";
import type { User } from "@/shared/lib/auth-client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/core/card";
import { GitHubIcon } from "@/shared/ui/icons/github-icon";

import { ProfileDetailsForm } from "@/features/profile/ui/profile-details-form";

type Props = {
  user: User;
};

type FeatureCard = { desc: string; icon: ComponentType<{ className?: string }>; title: string };

export function WelcomeFlow({ user }: Readonly<Props>) {
  const t = useTranslations("Welcome");
  const router = useRouter();
  const locale = useLocale();

  const FEATURE_CARDS = [
    {
      desc: t("feature_autodocs_desc"),
      icon: Book,
      title: t("feature_autodocs_title"),
    },
    {
      desc: t("feature_metrics_desc"),
      icon: ChartNoAxesColumn,
      title: t("feature_metrics_title"),
    },
    {
      desc: t("feature_integration_desc"),
      icon: GitHubIcon,
      title: t("feature_integration_title"),
    },
  ] as const satisfies readonly FeatureCard[];

  const handleSuccess = () => {
    router.push("/dashboard", { locale });
  };

  return (
    <div className="flex w-full max-w-5xl flex-col items-center gap-12 sm:gap-16">
      <div className="fade-in zoom-in-95 w-full max-w-md animate-in duration-300 ease-out">
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="font-bold text-2xl tracking-tight">{t("form_title")}</CardTitle>
            <CardDescription className="text-sm">{t("form_desc")}</CardDescription>
          </CardHeader>
          <CardContent>
            <ProfileDetailsForm
              buttonText={t("form_button")}
              isWelcome
              onSuccess={handleSuccess}
              user={user}
            />
          </CardContent>
        </Card>
      </div>

      <div className="fade-in slide-in-from-bottom-8 flex animate-in items-center justify-center gap-4 duration-300">
        {FEATURE_CARDS.map((item) => (
          <Card
            className={"flex w-full flex-col"}
            key={item.title}
          >
            <CardHeader>
              <item.icon className="size-5" />
              <CardTitle className="font-bold text-lg">{item.title}</CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground text-sm">{item.desc}</CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
