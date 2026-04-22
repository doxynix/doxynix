"use client";

import React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { FileCode, GitPullRequest, Trash2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { createPrSchema, type CreatePrValues } from "@/shared/api/schemas/pr";
import { trpc } from "@/shared/api/trpc";
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
import { Separator } from "@/shared/ui/core/separator";
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

const BRANCH_TIME = Date.now();

export function PrDraftSheet({ repoId }: Readonly<Props>) {
  const utils = trpc.useUtils();

  const { data: stagedFiles, isLoading: isFilesLoading } = trpc.prStaging.getStagedFiles.useQuery({
    repoId,
  });

  const applyPrMutation = trpc.generatedFix.applyFix.useMutation({
    onError: (err) => toast.error(`Failed to create PR: ${err.message}`),
    onSuccess: (data) => {
      if (data.success === true) {
        toast.success("Pull Request created successfully!");
        window.open(data.prUrl, "_blank");
        void utils.prStaging.getStagedFiles.invalidate({ repoId });
      }
    },
  });

  const form = useForm<CreatePrValues>({
    defaultValues: {
      branchName: `doxynix/fix-${BRANCH_TIME}`,
      prTitle: "Doxynix Suggested code improvements",
    },
    resolver: zodResolver(createPrSchema),
  });

  const onSubmit = (values: CreatePrValues) => {
    if (stagedFiles === undefined || stagedFiles.length === 0) {
      toast.error("No files in stage");
      return;
    }

    applyPrMutation.mutate({
      branch: values.branchName,
      estimatedImpact: 0,
      fixedFiles: stagedFiles.map((f) => ({
        filePath: f.filePath,
        newContent: f.content,
      })),
      fixId: "batch-pr",
      repoId,
      title: values.prTitle,
    });
  };

  const filesCount = stagedFiles?.length ?? 0;

  return (
    <Sheet onOpenChange={(open) => open === false && form.reset()}>
      <SheetTrigger asChild>
        <Button variant="outline" className="gap-2">
          <GitPullRequest className="size-4" />
          <span>PR Draft</span>
          {filesCount > 0 && <span className="text-xs">{filesCount}</span>}
        </Button>
      </SheetTrigger>

      <SheetContent className="flex flex-col gap-6 p-6 sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <GitPullRequest className="size-4" />
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
                <div className="flex h-20 items-center justify-center">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-40 w-full" />
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
                        <FileCode className="size-4" />
                        <span className="truncate text-xs">{file.filePath}</span>
                      </div>
                      <Button size="icon" variant="ghost" className="size-8">
                        <Trash2 />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>

          <Separator />

          <Form {...form}>
            <form
              id="pr-form"
              onSubmit={() => void form.handleSubmit(onSubmit)}
              className="space-y-4 border-t pt-4"
            >
              <FormField
                name="branchName"
                control={form.control}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="">Branch Name</FormLabel>
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
                    <FormLabel className="">PR Title</FormLabel>
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
            disabled={filesCount === 0 || applyPrMutation.isPending}
            form="pr-form"
            isLoading={applyPrMutation.isPending}
            loadingText="Processing..."
          >
            <GitPullRequest /> Open Pull Request
          </LoadingButton>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
