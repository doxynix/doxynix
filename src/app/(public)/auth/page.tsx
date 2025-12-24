import type { Metadata } from "next";

import { AuthCard } from "@/features/auth/ui";

export const metadata: Metadata = {
  title: "Авторизация",
};

export default function AuthPage() {
  return (
    <div className="flex items-center justify-center bg-background">
      <AuthCard />
    </div>
  );
}
