import { headers } from "next/headers";
import { unauthorized } from "next/navigation";

import { ProfileCard } from "@/entities/user/ui/profile-card";

import { auth } from "@/server/core/auth";

export async function ProfileDataLoader() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (session?.user == null) {
    unauthorized();
  }

  return <ProfileCard user={session.user} />;
}
