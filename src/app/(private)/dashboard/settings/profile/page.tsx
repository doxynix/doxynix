import { Suspense } from "react";
import { Metadata } from "next";

import { ProfileDataLoader, ProfileSkeleton } from "@/features/profile";

export const metadata: Metadata = {
  title: "Profile",
};

export default function ProfilePage() {
  return (
    <div className="flex w-full max-w-2xl flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h2 className="text-2xl font-bold tracking-tight">Profile</h2>
        <p className="text-muted-foreground text-sm">Manage your account settings</p>
      </div>
      <Suspense fallback={<ProfileSkeleton />}>
        <ProfileDataLoader />
      </Suspense>
    </div>
  );
}
