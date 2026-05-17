import { unauthorized } from "next/navigation";

import { ProfileCard } from "@/entities/user/ui/profile-card";

import { getServerAuthSession } from "@/server/core/auth";

export async function ProfileDataLoader() {
  const session = await getServerAuthSession();

  if (!session?.user) {
    unauthorized();
  }

  return <ProfileCard user={session.user} />;
}
