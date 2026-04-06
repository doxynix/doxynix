import { unauthorized } from "next/navigation";

import { ProfileCard } from "@/features/profile";

import { getServerAuthSession } from "@/server/infrastructure/auth";

export async function ProfileDataLoader() {
  const session = await getServerAuthSession();

  if (!session?.user) {
    unauthorized();
  }

  return <ProfileCard user={session.user} />;
}
