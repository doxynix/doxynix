import { InvitePageCard } from "@/features/workspace/ui/invite-page-card";

import { HydrateClient, prefetch, trpcProxy } from "@/server/core/trpc/prefetch";

export default async function InvitePage({
  params,
}: Readonly<{ params: Promise<{ token: string }> }>) {
  const { token } = await params;

  await prefetch(trpcProxy.workspace.previewInvite.queryOptions({ token }));

  return (
    <HydrateClient>
      <main className="flex min-h-dvh w-full items-center justify-center p-6">
        <InvitePageCard token={token} />
      </main>
    </HydrateClient>
  );
}
