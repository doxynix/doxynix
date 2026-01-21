import { redirect } from "next/navigation";

import { getServerAuthSession } from "@/shared/api/auth/auth-options";

import { ProfileCard } from "./profile-card";

export async function ProfileDataLoader() {
  const session = await getServerAuthSession();

  if (!session?.user) {
    redirect("/auth");
  }

  return <ProfileCard user={session.user} />;
}
