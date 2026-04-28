"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { FileIcon, GitPullRequest, Trash2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { createPrSchema, type CreatePrValues } from "@/shared/api/schemas/pr";
import { trpc } from "@/shared/api/trpc";
import { Badge } from "@/shared/ui/core/badge";
import { Button } from "@/shared/ui/core/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/shared/ui/core/form";
import { Input } from "@/shared/ui/core/input";
import { Label } from "@/shared/ui/core/label";
import { ScrollArea } from "@/shared/ui/core/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/shared/ui/core/sheet";
import { Skeleton } from "@/shared/ui/core/skeleton";
import { LoadingButton } from "@/shared/ui/kit/loading-button";

type Props = {
  repoId: string;
};

export function PrDraftSheet({ repoId }: Readonly<Props>) {
  const utils = trpc.useUtils();

  const { data: stagedFiles, isLoading: isFilesLoading } = trpc.prStaging.getStagedFiles.useQuery({
    repoId,
  });

  const openPrMutation = trpc.prStaging.openPullRequest.useMutation({
    onError: (err) => toast.error(`Failed to create PR: ${err.message}`),
    onSuccess: (data) => {
      if (data.success === true) {
        toast.success("Pull Request created successfully!");
        window.open(data.prUrl, "_blank");
        void utils.prStaging.getStagedFiles.invalidate({ repoId });
        void utils.generatedFix.getByRepository.invalidate({ repoId });
      }
    },
  });

  const unstageMutation = trpc.prStaging.unstageFile.useMutation({
    onError: (err) => toast.error(`Failed to remove file from draft: ${err.message}`),
    onSuccess: () => {
      void utils.prStaging.getStagedFiles.invalidate({ repoId });
    },
  });

  const form = useForm<CreatePrValues>({
    defaultValues: {
      branchName: `doxynix/fix-${crypto.randomUUID().slice(0, 8)}`,
      prTitle: "Doxynix Suggested code improvements",
    },
    resolver: zodResolver(createPrSchema),
  });

  const onSubmit = (values: CreatePrValues) => {
    if (stagedFiles === undefined || stagedFiles.length === 0) {
      toast.error("No files in stage");
      return;
    }

    openPrMutation.mutate({
      branch: values.branchName,
      repoId,
      title: values.prTitle,
    });
  };

  const filesCount = stagedFiles?.length ?? 0;

  return (
    <Sheet onOpenChange={(open) => open === false && form.reset()}>
      <SheetTrigger asChild>
        <Button variant="outline" className="relative gap-2">
          <GitPullRequest />
          <span>PR Draft</span>
          {filesCount > 0 && <Badge className="absolute -top-2 -right-2">{filesCount}</Badge>}
        </Button>
      </SheetTrigger>

      <SheetContent className="flex flex-col gap-6 p-6 sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <GitPullRequest />
            Pull Request Draft
          </SheetTitle>
          <SheetDescription>
            Review staged changes and create a new pull request to your repository.
          </SheetDescription>
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-6">
          <div className="space-y-4">
            <Label className="text-muted-foreground">Staged Files ({filesCount})</Label>
            <ScrollArea className="h-75 rounded-xl border p-2">
              {isFilesLoading === true ? (
                <div className="flex flex-col gap-2 p-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              ) : filesCount === 0 ? (
                <div className="text-muted-foreground flex h-20 items-center justify-center text-xs italic">
                  No files staged for PR yet.
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {stagedFiles?.map((file) => (
                    <div
                      key={file.filePath}
                      className="flex items-center justify-between rounded-xl border p-1"
                    >
                      <div className="flex items-center gap-2 p-1">
                        <FileIcon />
                        <span className="truncate text-xs">{file.filePath}</span>
                      </div>
                      <LoadingButton
                        disabled={unstageMutation.isPending}
                        isLoading={unstageMutation.isPending}
                        loadingText=""
                        size="icon"
                        variant="ghost"
                        aria-label="Unstage file"
                        onClick={() =>
                          unstageMutation.mutate({
                            filePath: file.filePath,
                            repoId,
                          })
                        }
                        className="hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 />
                      </LoadingButton>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>

          <Form {...form}>
            <form
              id="pr-form"
              onSubmit={(e) => void form.handleSubmit(onSubmit)(e)}
              className="space-y-4 border-t pt-4"
            >
              <FormField
                name="branchName"
                control={form.control}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-muted-foreground">Branch Name</FormLabel>
                    <FormControl>
                      <Input {...field} className="h-9 text-xs" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                name="prTitle"
                control={form.control}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-muted-foreground">PR Title</FormLabel>
                    <FormControl>
                      <Input {...field} className="h-9 text-xs" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </form>
          </Form>
        </div>

        <SheetFooter className="border-t pt-4">
          <LoadingButton
            type="submit"
            disabled={filesCount === 0 || openPrMutation.isPending}
            form="pr-form"
            isLoading={openPrMutation.isPending}
            loadingText="Processing..."
          >
            <GitPullRequest /> Open Pull Request
          </LoadingButton>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
