import { redirect } from "next/navigation";

import { getServerAuthSession } from "@/shared/api/auth/authOptions";

import { ProfileCard } from "./ProfileCard";

export async function ProfileDataLoader() {
  const session = await getServerAuthSession();

  if (!session?.user) {
    redirect("/auth");
  }

  return <ProfileCard user={session.user} />;
}
