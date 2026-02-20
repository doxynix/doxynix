"use client";

import { useRef, useState } from "react";
import type { Route } from "next";
import { useSearchParams } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { BookOpen } from "lucide-react";
import { signIn } from "next-auth/react";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { useDebounce } from "use-debounce";

import { CreateRepoSchema, type CreateRepoInput } from "@/shared/api/schemas/repo";
import { trpc } from "@/shared/api/trpc";
import { useClickOutside } from "@/shared/hooks/use-click-outside";
import { isGitHubUrl } from "@/shared/lib/utils";
import { useCreateRepoDialogStore } from "@/shared/model/create-repo-dialog.store";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/core/dialog";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/shared/ui/core/form";
import { Input } from "@/shared/ui/core/input";
import { ScrollArea } from "@/shared/ui/core/scroll-area";
import { Skeleton } from "@/shared/ui/core/skeleton";
import { Spinner } from "@/shared/ui/core/spinner";
import { GitHubIcon } from "@/shared/ui/icons/github-icon";
import { LoadingButton } from "@/shared/ui/kit/loading-button";

import { useRepoActions } from "@/entities/repo";
import { usePathname, useRouter } from "@/i18n/routing";
import { RepoItem } from "./repo-item";

const STALE_TIME = 1000 * 60 * 5; // TIME: 5 минут

export function CreateRepoDialog() {
  const tCommon = useTranslations("Common");
  const t = useTranslations("Dashboard");

  const { open, closeDialog } = useCreateRepoDialogStore();
  const { create } = useRepoActions();
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const containerRef = useRef<HTMLDivElement>(null);

  const form = useForm<CreateRepoInput>({
    resolver: zodResolver(CreateRepoSchema),
    defaultValues: { url: "" },
    mode: "onChange",
  });

  const urlValue = form.watch("url");
  const [debouncedValue] = useDebounce(urlValue, 300);

  useClickOutside(containerRef, () => setShowSuggestions(false), open);

  async function handleConnectGithub() {
    try {
      setLoading(true);
      await signIn("github");
    } finally {
      setLoading(false);
    }
  }

  const isUrl = isGitHubUrl(debouncedValue);
  const { data: suggestions, isFetching } = trpc.repo.searchGithub.useQuery(
    { query: debouncedValue },
    {
      enabled: debouncedValue.length >= 2 && !isUrl,
      staleTime: STALE_TIME,
    }
  );

  const { data: myGithubData, isFetching: isFetchingMyRepos } = trpc.repo.getMyGithubRepos.useQuery(
    undefined,
    {
      enabled: open,
      staleTime: STALE_TIME,
    }
  );

  const onSubmit = (values: CreateRepoInput) => {
    create.mutate(values, {
      onSuccess: () => {
        closeDialog();
        form.reset();
        const params = new URLSearchParams(searchParams.toString());
        params.delete("page");
        router.push(`${pathname}?${params.toString()}` as Route);
      },
    });
  };

  const handleSelectRepo = (repoUrl: string) => {
    form.setValue("url", repoUrl, { shouldValidate: true });
    setShowSuggestions(false);
  };

  const handleClose = (v: boolean) => {
    if (!v) {
      closeDialog();
      form.reset();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("repo_add_repository")}</DialogTitle>
          <DialogDescription>{t("repo_create_desc")} </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={(e) => void form.handleSubmit(onSubmit)(e)} className="grid gap-4 py-4">
            <div className="flex flex-col gap-3" ref={containerRef}>
              <FormField
                control={form.control}
                name="url"
                render={({ field }) => (
                  <FormItem className="relative">
                    <FormControl>
                      <div className="relative">
                        {isFetching ? (
                          <Spinner className="absolute top-2.5 left-2.5" />
                        ) : (
                          <GitHubIcon className="absolute top-2.5 left-2.5 h-4 w-4" />
                        )}
                        <Input
                          {...field}
                          className="pl-8 text-sm"
                          placeholder={t("repo_create_placeholder")}
                          autoComplete="off"
                          disabled={create.isPending}
                          maxLength={500}
                          onChange={(e) => {
                            field.onChange(e);
                            setShowSuggestions(true);
                          }}
                          onFocus={() => setShowSuggestions(true)}
                          onClick={() => setShowSuggestions(true)}
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                    {showSuggestions && suggestions && suggestions.length > 0 && (
                      <div className="bg-popover text-popover-foreground absolute top-full right-0 left-0 z-10 mt-1 h-80 overflow-y-auto rounded-xl border shadow-md">
                        {suggestions.map((repo) => (
                          <RepoItem
                            key={repo.fullName}
                            repo={repo}
                            onClick={() => handleSelectRepo(repo.fullName)}
                          />
                        ))}
                      </div>
                    )}
                  </FormItem>
                )}
              />
            </div>

            <div className="space-y-2">
              <div className="text-muted-foreground flex items-center gap-2 text-xs font-medium tracking-wider uppercase">
                <BookOpen className="h-3 w-3" /> {t("repo_your_repos")}
              </div>

              <div className="space-y-0.5">
                {isFetchingMyRepos ? (
                  <div className="h-70 rounded-xl border p-1">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className="flex flex-col gap-1 p-3">
                        <div className="flex items-center justify-between">
                          <Skeleton className="h-3.5 w-32" />
                          <Skeleton className="h-4 w-24" />
                        </div>
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-4 w-48" />
                      </div>
                    ))}
                  </div>
                ) : myGithubData?.isConnected === false ? (
                  <div className="h-70 rounded-xl border p-1">
                    <div className="xs:px-4 xs:py-8 flex h-full flex-col items-center justify-center px-2 py-4 text-center">
                      <p className="text-muted-foreground mb-3 text-sm">
                        {t("repo_connect_git_account")}{" "}
                      </p>
                      <LoadingButton
                        className="cursor-pointer"
                        variant="outline"
                        isLoading={loading}
                        loadingText="Connecting..."
                        disabled={loading}
                        onClick={() => void handleConnectGithub()}
                      >
                        <GitHubIcon /> {tCommon("connect")}
                      </LoadingButton>
                    </div>
                  </div>
                ) : (
                  <ScrollArea type="always" className="h-70 rounded-xl border p-1">
                    {myGithubData?.items.map((myRepo) => (
                      <RepoItem
                        key={myRepo.fullName}
                        disabled={create.isPending}
                        repo={myRepo}
                        onClick={() => handleSelectRepo(myRepo.fullName)}
                      />
                    ))}
                  </ScrollArea>
                )}
              </div>
            </div>
            <DialogFooter>
              <LoadingButton
                className="cursor-pointer"
                isLoading={create.isPending}
                loadingText="Adding..."
                disabled={create.isPending || !form.formState.isValid || !urlValue}
              >
                {tCommon("add")}
              </LoadingButton>
            </DialogFooter>
          </form>{" "}
        </Form>
      </DialogContent>
    </Dialog>
  );
}
