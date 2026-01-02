import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getServerAuthSession } from "@/shared/api/auth/authOptions";
import { AuthCard } from "@/features/auth/ui";

export const metadata: Metadata = {
  title: "Авторизация",
};

export default async function AuthPage() {
  const session = await getServerAuthSession();

  if (session) redirect("/dashboard");

  return <AuthCard />;
}
