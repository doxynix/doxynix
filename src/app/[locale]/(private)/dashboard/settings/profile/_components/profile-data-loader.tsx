import { getLocale } from "next-intl/server";

import { redirect } from "@/i18n/routing";

import { ProfileCard } from "@/features/profile";

import { getServerAuthSession } from "@/server/auth/options";

export async function ProfileDataLoader() {
  const session = await getServerAuthSession();
  const locale = await getLocale();

  if (!session?.user) {
    redirect({ href: "/auth", locale });
    return null;
  }

  return <ProfileCard user={session.user} />;
}
