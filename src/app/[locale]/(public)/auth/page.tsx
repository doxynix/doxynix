import { getLocale } from "next-intl/server";

import { redirect } from "@/shared/i18n/routing";
import { createMetadata } from "@/shared/lib/metadata";

import { AuthForm } from "@/features/auth/ui/auth-form";

import { getServerAuthSession } from "@/server/core/auth";

export const generateMetadata = createMetadata("sign_in_title", "sign_in_desc");

export default async function AuthPage() {
  const session = await getServerAuthSession();
  const locale = await getLocale();

  if (session) redirect({ href: "/dashboard", locale });

  return <AuthForm />;
}
