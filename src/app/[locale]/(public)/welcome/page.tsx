import { unauthorized } from "next/navigation";

import { WelcomeFlow } from "@/widgets/welcome-flow/ui/welcome-flow";

import { getServerAuthSession } from "@/server/shared/infrastructure/auth";

export default async function WelcomePage() {
  const session = await getServerAuthSession();

  if (!session?.user) {
    unauthorized();
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col items-center justify-center pt-16">
      <div className="mb-12 flex flex-col items-center gap-4">
        <h1 className="text-8xl">Welcome to Doxynix!</h1>
        <p className="text-muted-foreground">
          Your intelligent companion for GitHub repository documentation. Let&apos;s get your
          profile set up.
        </p>
      </div>

      <WelcomeFlow user={session.user} />
    </div>
  );
}
