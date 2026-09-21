"use client";

import { useState } from "react";
import { CreatePrSchema, type CreatePrValues } from "@doxynix/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { FileIcon, GitPullRequest, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { trpc } from "@/shared/api/trpc";
import { generateBranchName } from "@/shared/lib/get-branch-name";
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
import { LoadingButton } from "@/shared/ui/kit/loading-button";

type Props = {
  repoId: string;
};

export function PrDraftSheet({ repoId }: Readonly<Props>) {
  const tCommon = useTranslations("Common");
  const t = useTranslations("Dashboard");
  const [open, setOpen] = useState(false);
  const [removingFiles, setRemovingFiles] = useState<Set<string>>(new Set());
  const utils = trpc.useUtils();

  const { data: stagedFiles, isLoading: isFilesLoading } = trpc.analysis.getStagedFiles.useQuery({
    repoId,
  });

  const openPrMutation = trpc.analysis.openPullRequest.useMutation({
    onError: (err) => toast.error(t("repo_pr_draft_create_error", { message: err.message })),
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

        void utils.analysis.getStagedFiles.invalidate();
        void utils.analysis.getByRepository.invalidate();
        setOpen(false);
      }
    },
  });

  const unstageMutation = trpc.analysis.unstageFile.useMutation({
    onError: (err) => toast.error(t("repo_pr_draft_unstage_error", { message: err.message })),
    onSuccess: () => {
      void utils.analysis.getStagedFiles.invalidate();
    },
  });

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

  const filesCount = stagedFiles?.length ?? 0;

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

      <SheetContent className="flex flex-col gap-6 p-6 sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <GitPullRequest />
            {t("repo_pr_draft_title")}
          </SheetTitle>
          <SheetDescription>{t("repo_pr_draft_desc")}</SheetDescription>
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-6">
          <div className="flex flex-col gap-4">
            <Label className="text-muted-foreground">
              {t("repo_pr_draft_staged_label", { count: filesCount })}
            </Label>
            <ScrollArea className="h-75 rounded-xl border p-2">
              {isFilesLoading ? (
                <div className="flex flex-col gap-2 p-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton
                      className="h-10 w-full"
                      key={i}
                    />
                  ))}
                </div>
              ) : filesCount === 0 ? (
                <div className="flex h-20 items-center justify-center text-muted-foreground text-xs italic">
                  {t("repo_pr_draft_empty_staged")}
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {stagedFiles?.map((file) => {
                    const isRemoving = removingFiles.has(file.filePath);

                    return (
                      <div
                        className="flex items-center justify-between rounded-xl border p-1"
                        key={file.filePath}
                      >
                        <div className="flex items-center gap-2 p-1">
                          <FileIcon />
                          <span className="truncate text-xs">{file.filePath}</span>
                        </div>
                        <LoadingButton
                          aria-label={t("repo_pr_draft_unstage_aria")}
                          className="hover:bg-destructive/10 hover:text-destructive"
                          disabled={isRemoving}
                          isLoading={isRemoving}
                          loadingText=""
                          onClick={() => {
                            setRemovingFiles((prev) => {
                              const next = new Set(prev);
                              next.add(file.filePath);
                              return next;
                            });

                            unstageMutation.mutate(
                              {
                                filePath: file.filePath,
                                repoId,
                              },
                              {
                                onSettled: () => {
                                  setRemovingFiles((prev) => {
                                    const next = new Set(prev);
                                    next.delete(file.filePath);
                                    return next;
                                  });
                                },
                              },
                            );
                          }}
                          size="icon"
                          variant="ghost"
                        >
                          <Trash2 />
                        </LoadingButton>
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </div>

          <Form {...form}>
            <form
              className="flex flex-col gap-4 border-t pt-4"
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

        <SheetFooter className="border-t pt-4">
          <LoadingButton
            disabled={filesCount === 0 || openPrMutation.isPending}
            form="pr-form"
            isLoading={openPrMutation.isPending}
            loadingText={tCommon("processing")}
            type="submit"
          >
            <GitPullRequest /> {t("repo_pr_draft_open_pr_button")}
          </LoadingButton>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
