"use client";

import { type ComponentType } from "react";
import { Book, ChartNoAxesColumn } from "lucide-react";
import type { User } from "next-auth";
import { useLocale } from "next-intl";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/core/card";
import { GitHubIcon } from "@/shared/ui/icons/github-icon";
import { useRouter } from "@/i18n/routing";

import { ProfileDetailsForm } from "@/features/profile";

type Props = {
  user: User;
};

type FeatureTypes = { desc: string; icon: ComponentType<{ className?: string }>; title: string };

const FEATURE_CARDS: FeatureTypes[] = [
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
];

export function WelcomeFlow({ user }: Readonly<Props>) {
  const router = useRouter();
  const locale = useLocale();

  const handleSuccess = () => {
    router.push("/dashboard", { locale });
  };

  return (
    <div className="flex w-full max-w-5xl flex-col items-center gap-12 sm:gap-16">
      <div className="animate-in fade-in zoom-in-95 w-full max-w-md duration-500 ease-out">
        <Card className="border-border/60 shadow-lg shadow-black/5">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold tracking-tight">
              What should we call you?
            </CardTitle>
            <CardDescription className="text-sm">
              Please enter your name so we can personalize your experience.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ProfileDetailsForm
              isWelcome
              buttonText="Continue to Dashboard"
              loadingText="Setting up your workspace..."
              user={user}
              onSuccess={handleSuccess}
            />
          </CardContent>
        </Card>
      </div>

      <div className="animate-in fade-in slide-in-from-bottom-8 flex items-center justify-center gap-4 duration-500">
        {FEATURE_CARDS.map((item) => (
          <Card key={item.title} className={"bg-card/50 flex w-full flex-col"}>
            <CardHeader>
              <item.icon className="h-5 w-5" />
              <CardTitle className="text-lg font-semibold">{item.title}</CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground text-sm">{item.desc}</CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
