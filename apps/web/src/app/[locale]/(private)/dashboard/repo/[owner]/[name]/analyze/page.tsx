import { Sparkles } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import { redirect } from "@/shared/i18n/navigation";
import { createRepoMetadata } from "@/shared/lib/metadata";
import type { RepoPageProps } from "@/shared/lib/next.types";
import {
  intentToDocTypes,
  intentToResultsPath,
  parseOnboardingIntent,
} from "@/shared/lib/onboarding-intent";
import { Alert, AlertDescription, AlertTitle } from "@/shared/ui/core/alert";

import { RepoAnalysisLive } from "@/features/repo-setup/ui/repo-analysis-live";
import { RepoSetup } from "@/features/repo-setup/ui/repo-setup";

import { getQueryClient, HydrateClient, trpcProxy } from "@/server/core/trpc/prefetch";
import { repoFetchers } from "@/server/modules/repos/repo.fetchers";

export const generateMetadata = createRepoMetadata("analyze");

const COMPLETION_LABEL_KEYS = {
  ARCHITECTURE: "repo_analysis_open_architecture",
  DOCUMENTATION: "repo_analysis_open_documentation",
  RISKS: "repo_analysis_open_risks",
} as const;

export default async function AnalyzePage({ params, searchParams }: Readonly<RepoPageProps>) {
  const { name, owner } = await params;
  const t = await getTranslations("Dashboard");
  const locale = await getLocale();
  const search = await searchParams;
  const isOnboarding = search.onboarding === "1";
  const intent = parseOnboardingIntent(search.intent);
  const initialDocTypes = isOnboarding && intent != null ? intentToDocTypes(intent) : undefined;
  const completionHref =
    isOnboarding && intent != null
      ? (intentToResultsPath(intent, owner, name) ?? undefined)
      : undefined;
  const completionLabel = intent == null ? undefined : t(COMPLETION_LABEL_KEYS[intent]);

  const repo = await repoFetchers.getRepoOrNotFound(owner, name);

  const lastAnalysis = await getQueryClient().query(
    trpcProxy.analysis.getLatest.queryOptions({ repoId: repo.id }),
  );

  if (isOnboarding && completionHref != null && lastAnalysis?.status === "DONE") {
    return redirect({ href: completionHref, locale });
  }

  const isRunning =
    lastAnalysis?.status === "PENDING" &&
    lastAnalysis.jobId != null &&
    lastAnalysis.publicAccessToken != null;

  return (
    <HydrateClient>
      <div className="mx-auto px-4 py-6">
        {isRunning ? (
          <RepoAnalysisLive
            accessToken={lastAnalysis.publicAccessToken ?? ""}
            analysisId={lastAnalysis.id}
            completionHref={completionHref}
            completionLabel={completionLabel}
            jobId={lastAnalysis.jobId ?? ""}
            name={name}
            owner={owner}
            repoId={repo.id}
          />
        ) : (
          <div className="flex flex-col gap-4">
            {isOnboarding && (
              <Alert>
                <Sparkles />
                <AlertTitle>{t("setup_onboarding_title")}</AlertTitle>
                <AlertDescription>{t("setup_onboarding_desc")}</AlertDescription>
              </Alert>
            )}
            <RepoSetup
              initialDocTypes={initialDocTypes}
              repo={repo}
              selectRecommendedOnLoad={isOnboarding}
            />
          </div>
        )}
      </div>
    </HydrateClient>
  );
}
