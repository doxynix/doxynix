import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getServerAuthSession } from "@/shared/api/auth/auth-options";
import { AuthForm } from "@/features/auth";

export const metadata: Metadata = {
  title: "Sign In",
  description: "Log in to your Doxynix dashboard to manage repositories and API keys.",
};

export default async function AuthPage() {
  const session = await getServerAuthSession();

  if (session) redirect("/dashboard");

  return <AuthForm />;
}
