"use client";

import { trpc, type DocType } from "@/shared/api/trpc";
import { Alert, AlertDescription, AlertTitle } from "@/shared/ui/core/alert";
import { Skeleton } from "@/shared/ui/core/skeleton";

export function RepoDocsContent({ repoId, type }: Readonly<{ repoId: string; type: DocType }>) {
  const { data, error, isLoading } = trpc.repoDetails.getDocumentContent.useQuery({
    repoId,
    type,
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-100 w-full" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>Failed to load documentation content.</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
      <article
        dangerouslySetInnerHTML={{ __html: data.html }}
        className="prose prose-invert prose-pre:p-0 prose-pre:bg-transparent max-w-none wrap-break-word"
      />
    </div>
  );
}
