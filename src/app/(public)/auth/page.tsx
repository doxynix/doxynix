import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getServerAuthSession } from "@/shared/api/auth/authOptions";
import { AuthForm } from "@/features/auth";

export const metadata: Metadata = {
  title: "Авторизация",
};

export default async function AuthPage() {
  const session = await getServerAuthSession();

  if (session) redirect("/dashboard");

  return <AuthForm />;
}
