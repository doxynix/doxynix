"use client";
import { useState } from "react";
import { CreatePrSchema, type CreatePrValues, generateBranchName } from "@doxynix/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, EyeOff, GitPullRequest } from "lucide-react";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { useTRPC } from "@/shared/api/trpc";
import { useErrorMessage } from "@/shared/i18n/use-error-message";
import { trackClientEvent } from "@/shared/lib/posthog-client";
import { AppBadge } from "@/shared/ui/core/badge";
import { AppButton } from "@/shared/ui/core/button";
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
import { SkeletonList, SkeletonText } from "@/shared/ui/kit/app-skeleton";
import { LoadingButton } from "@/shared/ui/kit/loading-button";

import { StagedFileDiff } from "./staged-file-diff";

type Props = {
  repoId: string;
};

export function PrDraftSheet({ repoId }: Readonly<Props>) {
  const trpc = useTRPC();
  const t = useTranslations("Dashboard");
  const tCommon = useTranslations("Common");
  const errorMessage = useErrorMessage();
  const [open, setOpen] = useState(false);
  const [removingFiles, setRemovingFiles] = useState<Set<string>>(new Set());
  const [hiddenFiles, setHiddenFiles] = useState<Set<string>>(new Set());
  const [showHidden, setShowHidden] = useState(false);
  const queryClient = useQueryClient();

  const { data: stagedFiles, isLoading: isFilesLoading } = useQuery(
    trpc.analysis.getStagedFiles.queryOptions({
      repoId,
    }),
  );

  const openPrMutation = useMutation(
    trpc.analysis.openPullRequest.mutationOptions({
      onError: (err) => toast.error(errorMessage(err)),
      onSuccess: (data) => {
        if (data.success) {
          toast.success(t("repo_pr_draft_created"), {
            action: {
              label: t("repo_pr_draft_view"),
              onClick: () => {
                window.open(data.prUrl, "_blank", "noopener,noreferrer");
              },
            },
          });

          trackClientEvent("pr_opened", {
            repo_id: repoId,
            staged_files: filesCount,
          });

          void queryClient.invalidateQueries(trpc.analysis.getStagedFiles.pathFilter());
          setOpen(false);
        }
      },
    }),
  );

  const unstageMutation = useMutation(
    trpc.analysis.unstageFile.mutationOptions({
      onError: (err) => toast.error(errorMessage(err)),
      onSuccess: () => {
        void queryClient.invalidateQueries(trpc.analysis.getStagedFiles.pathFilter());
      },
    }),
  );

  const handleUnstage = (filePath: string) => {
    setRemovingFiles((prev) => {
      const next = new Set(prev);
      next.add(filePath);
      return next;
    });

    unstageMutation.mutate(
      { filePath, repoId },
      {
        onSettled: () => {
          setRemovingFiles((prev) => {
            const next = new Set(prev);
            next.delete(filePath);
            return next;
          });
        },
      },
    );
  };

  const form = useForm<CreatePrValues>({
    defaultValues: {
      branchName: generateBranchName(),
      prTitle: t("repo_pr_draft_default_title"),
    },
    resolver: zodResolver(CreatePrSchema),
  });

  const onSubmit = (values: CreatePrValues) => {
    if (stagedFiles == null || stagedFiles.length === 0) {
      toast.error(t("repo_pr_draft_no_files"));
      return;
    }

    openPrMutation.mutate({
      branch: values.branchName,
      repoId,
      title: values.prTitle,
    });
  };

  const toggleHidden = (filePath: string) => {
    setHiddenFiles((prev) => {
      const next = new Set(prev);
      if (next.has(filePath)) {
        next.delete(filePath);
      } else {
        next.add(filePath);
      }
      return next;
    });
  };

  const filesCount = stagedFiles?.length ?? 0;
  const visibleFiles = stagedFiles?.filter((file) => !hiddenFiles.has(file.filePath)) ?? [];
  const hiddenStagedFiles = stagedFiles?.filter((file) => hiddenFiles.has(file.filePath)) ?? [];
  const renderedFiles = showHidden ? [...visibleFiles, ...hiddenStagedFiles] : visibleFiles;

  return (
    <Sheet
      onOpenChange={(openDialog) => {
        setOpen(openDialog);
        form.reset();
      }}
      open={open}
    >
      <SheetTrigger asChild>
        <AppButton
          className="relative gap-2"
          variant="outline"
        >
          <GitPullRequest />
          <span>{t("repo_pr_draft_trigger_label")}</span>
          {filesCount > 0 && <AppBadge className="absolute -top-2 -right-2">{filesCount}</AppBadge>}
        </AppButton>
      </SheetTrigger>

      <SheetContent
        className="@container flex flex-col gap-4 p-6"
        resizable={{
          defaultWidth: 512,
          maxWidth: 900,
          minWidth: 360,
          storageKey: "sheet-pr-draft-width",
        }}
      >
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <GitPullRequest />
            {t("repo_pr_draft_title")}
          </SheetTitle>
          <SheetDescription>{t("repo_pr_draft_desc")}</SheetDescription>
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-4">
          <div className="flex min-h-0 flex-1 flex-col gap-4">
            <div className="flex shrink-0 items-center justify-between gap-2">
              <Label className="text-muted-foreground">
                {t("repo_pr_draft_staged_label", { count: filesCount })}
              </Label>
              {hiddenStagedFiles.length > 0 && (
                <AppButton
                  className="h-7 gap-1.5 px-2 text-xs"
                  onClick={() => setShowHidden((prev) => !prev)}
                  variant="ghost"
                >
                  {showHidden ? <EyeOff /> : <Eye />}
                  {showHidden ? tCommon("hide") : tCommon("show")}
                  <AppBadge variant="secondary">{hiddenStagedFiles.length}</AppBadge>
                </AppButton>
              )}
            </div>
            <ScrollArea className="min-h-0 flex-1 rounded-xl border p-2">
              {isFilesLoading ? (
                <SkeletonList
                  className="flex flex-col gap-2"
                  count={5}
                  itemClassName="flex items-center justify-between rounded-xl border p-1"
                  renderItem={() => (
                    <>
                      <div className="flex items-center gap-2 p-1">
                        <Skeleton className="size-6" />
                        <SkeletonText
                          lines={1}
                          widths={["w-40"]}
                        />
                      </div>
                      <Skeleton className="size-9 rounded-xl" />
                    </>
                  )}
                />
              ) : filesCount === 0 ? (
                <div className="flex h-20 items-center justify-center text-muted-foreground text-xs italic">
                  {t("repo_pr_draft_empty_staged")}
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {renderedFiles.map((file) => (
                    <StagedFileDiff
                      file={file}
                      isHidden={hiddenFiles.has(file.filePath)}
                      isRemoving={removingFiles.has(file.filePath)}
                      key={file.filePath}
                      onToggleHidden={() => toggleHidden(file.filePath)}
                      onUnstage={() => handleUnstage(file.filePath)}
                      repoId={repoId}
                    />
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>

          <Form {...form}>
            <form
              className="grid shrink-0 gap-4 border-t pt-4 @[28rem]:grid-cols-2"
              id="pr-form"
              onSubmit={(e) => void form.handleSubmit(onSubmit)(e)}
            >
              <FormField
                control={form.control}
                name="branchName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-muted-foreground">
                      {t("repo_pr_draft_branch_label")}
                    </FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        className="h-9 text-xs"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="prTitle"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-muted-foreground">
                      {t("repo_pr_draft_title_label")}
                    </FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        className="h-9 text-xs"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </form>
          </Form>
        </div>

        <SheetFooter className="border-t p-0 pt-4 @[28rem]:flex-row @[28rem]:justify-end">
          <LoadingButton
            className="w-full @[28rem]:w-auto"
            disabled={filesCount === 0 || openPrMutation.isPending}
            form="pr-form"
            isLoading={openPrMutation.isPending}
            type="submit"
          >
            <GitPullRequest /> {t("repo_pr_draft_open_pr_button")}
          </LoadingButton>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
