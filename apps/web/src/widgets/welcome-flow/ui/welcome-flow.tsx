"use client";

import type { ComponentType } from "react";
import { Book, ChartNoAxesColumn } from "lucide-react";
import { useLocale } from "next-intl";

import { useRouter } from "@/shared/i18n/navigation";
import type { User } from "@/shared/lib/auth-client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/core/card";
import { GitHubIcon } from "@/shared/ui/icons/github-icon";

import { ProfileDetailsForm } from "@/features/profile/ui/profile-details-form";

type Props = {
  user: User;
};

type FeatureCard = { desc: string; icon: ComponentType<{ className?: string }>; title: string };

const FEATURE_CARDS = [
  {
    desc: "Generate comprehensive documentation for your repositories in seconds.",
    icon: Book,
    title: "Auto-Documentation",
  },
  {
    desc: "Visualize codebase health, complexity, and contribution patterns.",
    icon: ChartNoAxesColumn,
    title: "Code Metrics",
  },
  {
    desc: "Connect directly with your GitHub repositories for real-time updates.",
    icon: GitHubIcon,
    title: "Seamless Integration",
  },
] as const satisfies readonly FeatureCard[];

export function WelcomeFlow({ user }: Readonly<Props>) {
  const router = useRouter();
  const locale = useLocale();

  const handleSuccess = () => {
    router.push("/dashboard", { locale });
  };

  return (
    <div className="flex w-full max-w-5xl flex-col items-center gap-12 sm:gap-16">
      <div className="fade-in zoom-in-95 w-full max-w-md animate-in duration-300 ease-out">
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="font-bold text-2xl tracking-tight">
              What should we call you?
            </CardTitle>
            <CardDescription className="text-sm">
              Please enter your name so we can personalize your experience.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ProfileDetailsForm
              buttonText="Continue to Dashboard"
              isWelcome
              loadingText="Setting up your workspace..."
              onSuccess={handleSuccess}
              user={user}
            />
          </CardContent>
        </Card>
      </div>

      <div className="fade-in slide-in-from-bottom-8 flex animate-in items-center justify-center gap-4 duration-300">
        {FEATURE_CARDS.map((item) => (
          <Card className={"flex w-full flex-col"} key={item.title}>
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
