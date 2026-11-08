import { headers } from "next/headers";
import { getLocale } from "next-intl/server";

import { redirect } from "@/shared/i18n/navigation";
import { createMetadata } from "@/shared/lib/metadata";
import { safeInternalPath } from "@/shared/lib/safe-redirect";

import { AuthForm } from "@/features/auth/ui/auth-form";

import { auth } from "@/server/core/auth";

export const generateMetadata = createMetadata("sign_in_title", "sign_in_desc");

export default async function AuthPage({
  searchParams,
}: Readonly<{ searchParams: Promise<{ next?: string | string[] }> }>) {
  const { next } = await searchParams;
  const redirectTo = safeInternalPath(next);
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  const locale = await getLocale();

  if (session != null) {
    redirect({ href: redirectTo, locale });
  }

  return <AuthForm redirectTo={redirectTo} />;
}
