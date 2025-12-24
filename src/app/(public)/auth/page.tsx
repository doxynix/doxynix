import type { Metadata } from "next";

import { AuthCard } from "@/features/auth/ui";

export const metadata: Metadata = {
  title: "Авторизация",
};

export default function AuthPage() {
  return (
    <div className="bg-background flex items-center justify-center">
      <AuthCard />
    </div>
  );
}
