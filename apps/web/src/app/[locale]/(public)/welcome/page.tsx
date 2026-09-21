import { headers } from "next/headers";
import { unauthorized } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { createMetadata } from "@/shared/lib/metadata";

import { WelcomeFlow } from "@/widgets/welcome-flow/ui/welcome-flow";

import { auth } from "@/server/core/auth";

export const generateMetadata = createMetadata("welcome_title", "welcome_desc");

export default async function WelcomePage() {
  const t = await getTranslations("Welcome");

  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    unauthorized();
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col items-center justify-center pt-16">
      <div className="mb-12 flex flex-col items-center gap-4">
        <h1 className="text-8xl">{t("page_title")}</h1>
        <p className="text-muted-foreground">{t("page_desc")}</p>
      </div>

      <WelcomeFlow user={session.user} />
    </div>
  );
}
