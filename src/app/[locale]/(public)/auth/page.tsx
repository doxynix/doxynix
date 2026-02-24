import { getLocale } from "next-intl/server";

import { createMetadata } from "@/shared/lib/metadata";
import { redirect } from "@/i18n/routing";

import { AuthForm } from "@/features/auth";

import { getServerAuthSession } from "@/server/auth/options";

export const generateMetadata = createMetadata("sign_in_title", "sign_in_desc");

export default async function AuthPage() {
  const session = await getServerAuthSession();
  const locale = await getLocale();

  if (session) redirect({ href: "/dashboard", locale });

  return <AuthForm />;
}
