import { notFound } from "next/navigation";

import { api } from "@/server/api/server";
import { getServerAuthSession } from "@/server/infrastructure/auth";

type Props = {
  params: Promise<{ name: string; owner: string }>;
};

export default async function SharedDocsPage({ params }: Readonly<Props>) {
  const { name, owner } = await params;
  const session = await getServerAuthSession();

  const repo = await (await api()).repo.getByName({ name, owner });

  if (repo == null) notFound();

  if (repo.visibility === "PRIVATE" && !session) {
    notFound();
  }

  return <div className=""> </div>;
  // <ThemeProvider
  //   disableTransitionOnChange
  //   attribute="class"
  //   defaultTheme="dark"
  //   forcedTheme="dark"
  //   storageKey="doxynix-theme"
  // >
  //{
  // <div className="min-h-dvh bg-background">
  //        <header className="border-b bg-card/50 backdrop-blur-md px-6 py-4 flex justify-between items-center sticky top-0 z-50">
  //       <div className="flex items-center gap-2">
  //         <div className="size-6 bg-primary rounded flex items-center justify-center text-primary-foreground font-bold text-xs mr-1">D</div>
  //         <span className="font-bold text-foreground">Doxynix</span>
  //       <span className="text-muted-foreground">/</span>
  //     <span className="font-medium text-muted-foreground">{owner}</span>
  //   <span className="text-muted-foreground">/</span>
  //            <span className="font-bold text-foreground">{name}</span>
  //        </div>
  //
  //        <Button variant="outline" size="sm" asChild className="gap-2 text-xs h-8">
  //        <Link href={`/dashboard/repo/${owner}/${name}/docs`}>
  //        Open in Dashboard <ExternalLink className="size-3" />
  //    </Link>
  //     </Button>
  // </header>

  //   <main className="container max-w-7xl mx-auto py-10 px-6">
  //   <RepoDocsContainer id={repo.id} />
  // </main>
  //</div>
  // { </ThemeProvider>
  // );
  //}
}
