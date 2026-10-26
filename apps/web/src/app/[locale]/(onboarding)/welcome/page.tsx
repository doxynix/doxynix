import { headers } from "next/headers";
import { getLocale } from "next-intl/server";

import { redirect } from "@/shared/i18n/navigation";
import { createMetadata } from "@/shared/lib/metadata";
import type { PageProps } from "@/shared/lib/next.types";

import { WelcomeFlow } from "@/widgets/welcome-flow/ui/welcome-flow";

import { auth } from "@/server/core/auth";
import { prisma } from "@/server/core/db";
import { onboardingService } from "@/server/modules/users/onboarding.service";

export const generateMetadata = createMetadata("welcome_title", "welcome_desc");

export default async function WelcomePage({ searchParams }: Readonly<PageProps>) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  const locale = await getLocale();

  if (session?.user == null) {
    return redirect({ href: "/auth", locale });
  }

  const state = await onboardingService.getOnboardingState(prisma, session.user.id);
  const params = await searchParams;
  const isResume = params.resume === "1";

  if (state.activatedAt != null || state.hasCompletedAnalysis) {
    return redirect({ href: "/dashboard", locale });
  }

  if ((state.completedAt != null || state.repoCount > 0) && !isResume) {
    return redirect({ href: "/dashboard", locale });
  }

  return (
    <div className="mx-auto flex w-full min-w-0 max-w-6xl flex-1 items-center px-4 py-8 sm:px-6">
      <WelcomeFlow
        initialState={state}
        user={session.user}
      />
    </div>
  );
}
