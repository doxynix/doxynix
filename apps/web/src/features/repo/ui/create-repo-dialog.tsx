"use client";

import { useRef, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Book, Plus, RefreshCcw } from "lucide-react";
import { useTranslations } from "next-intl";
import { useQueryState } from "nuqs";
import posthog from "posthog-js";
import { useForm, useWatch } from "react-hook-form";

import { type CreateRepoInput, CreateRepoSchema } from "@/shared/api/schemas/repo";
import { trpc } from "@/shared/api/trpc";
import { useClickOutside } from "@/shared/hooks/use-click-outside";
import { useDebounce } from "@/shared/hooks/use-debounce";
import { authClient } from "@/shared/lib/auth-client";
import { isGitHubUrl } from "@/shared/lib/github-url";
import { AppButton } from "@/shared/ui/core/button";
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
import { AppAvatar } from "@/shared/ui/kit/app-avatar";
import { AppTooltip } from "@/shared/ui/kit/app-tooltip";
import { ExternalLink } from "@/shared/ui/kit/external-link";
import { LoadingButton } from "@/shared/ui/kit/loading-button";

import {
  useCreateRepoActions,
  useCreateRepoOpen,
} from "@/entities/repo/model/use-create-repo-dialog.store";
import { useRepoActions } from "@/entities/repo/model/use-repo-actions";
import { RepoItem } from "@/entities/repo/ui/repo-item";

const STALE_TIME = 1000 * 60 * 5; // TIME: 5 минут

export function CreateRepoDialog() {
  const tCommon = useTranslations("Common");
  const t = useTranslations("Dashboard");
  const { refetch: getInstallUrl } = trpc.githubApp.getGithubInstallUrl.useQuery(
    {},
    {
      enabled: false,
    },
  );

  const open = useCreateRepoOpen();
  const { setOpen } = useCreateRepoActions();
  const { create } = useRepoActions();

  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingOauth, setLoadingOauth] = useState(false);
  const [, setPage] = useQueryState("page");

  const containerRef = useRef<HTMLDivElement>(null);

  const form = useForm<CreateRepoInput>({
    defaultValues: { url: "" },
    mode: "onChange",
    resolver: zodResolver(CreateRepoSchema),
  });

  const urlValue = useWatch({ control: form.control, name: "url" });
  const debouncedValue = useDebounce(urlValue, 300);

  useClickOutside(containerRef, () => setShowSuggestions(false), open);

  async function handleInstallGitHubApp() {
    setLoading(true);
    posthog.capture("github_app_install_started");

    try {
      const { data: url, error } = await getInstallUrl();

      if (error != null || url == null) {
        posthog.capture("github_app_install_failed");
        return;
      }

      window.location.assign(url);
    } catch {
      posthog.capture("github_app_install_failed");
    } finally {
      setLoading(false);
    }
  }

  const isUrl = isGitHubUrl(debouncedValue);
  const { data: suggestions, isFetching } = trpc.githubBrowse.searchGithub.useQuery(
    { query: debouncedValue },
    {
      enabled: debouncedValue.length >= 2 && !isUrl,
      staleTime: STALE_TIME,
    },
  );

  const {
    data: myGithubData,
    isFetching: isFetchingMyRepos,
    refetch: refetchMyRepos,
  } = trpc.githubApp.getMyGithubRepos.useQuery(
    {},
    {
      enabled: open,
      staleTime: STALE_TIME,
    },
  );

  const closeDialog = () => {
    setOpen(false);
    setShowSuggestions(false);
    form.reset();
  };

  const onSubmit = (values: CreateRepoInput) => {
    create.mutate(values, {
      onSuccess: () => {
        closeDialog();
        void setPage(null);
      },
    });
  };

  async function handleSignIn() {
    try {
      setLoadingOauth(true);
      posthog.capture("github_oauth_started");

      const { error } = await authClient.signIn.social({
        callbackURL: "/dashboard",
        provider: "github",
      });
      if (error != null) {
        posthog.capture("github_oauth_failed");
      }
    } catch {
      posthog.capture("github_oauth_failed");
    } finally {
      setLoadingOauth(false);
    }
  }

  const handleSelectRepo = (repoUrl: string) => {
    form.setValue("url", repoUrl, { shouldValidate: true });
    setShowSuggestions(false);
  };

  const handleClose = (v: boolean) => {
    if (!v) {
      closeDialog();
    }
  };

  const oauthStatus = myGithubData?.oauthStatus;

  return (
    <Dialog onOpenChange={handleClose} open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("repo_add_repository")}</DialogTitle>
          <DialogDescription>{t("repo_create_desc")} </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form className="grid gap-4 py-4" onSubmit={(e) => void form.handleSubmit(onSubmit)(e)}>
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
                          <GitHubIcon className="absolute top-2.5 left-2.5 size-4" />
                        )}
                        <Input
                          {...field}
                          autoComplete="off"
                          className="pl-8 text-sm"
                          disabled={create.isPending}
                          maxLength={500}
                          onChange={(e) => {
                            field.onChange(e);
                            setShowSuggestions(true);
                          }}
                          onClick={() => setShowSuggestions(true)}
                          onFocus={() => setShowSuggestions(true)}
                          placeholder={t("repo_create_placeholder")}
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                    {showSuggestions && suggestions && suggestions.length > 0 && (
                      <div className="absolute top-full right-0 left-0 z-10 mt-1 h-80 overflow-y-auto rounded-xl border bg-popover text-popover-foreground">
                        {suggestions.map((repo) => (
                          <RepoItem
                            key={repo.fullName}
                            onClick={() => handleSelectRepo(repo.fullName)}
                            repo={repo}
                          />
                        ))}
                      </div>
                    )}
                  </FormItem>
                )}
              />
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between font-medium text-xs tracking-wider">
                <div className="flex items-center gap-2 text-muted-foreground uppercase">
                  <Book className="size-3" />
                  {t("repo_your_repos")}
                </div>

                {myGithubData?.installations != null && myGithubData.installations.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {myGithubData.installations.map((inst) => (
                      <AppTooltip content={inst.login} key={inst.id}>
                        <ExternalLink
                          className="flex items-center gap-1 hover:underline"
                          href={inst.manageUrl ?? ""}
                        >
                          <AppAvatar
                            alt={inst.login}
                            fallbackText={inst.login}
                            sizeClassName="size-6"
                            src={inst.avatar}
                          />
                        </ExternalLink>
                      </AppTooltip>
                    ))}
                    <AppTooltip content="Add new">
                      <LoadingButton
                        className="size-6"
                        disabled={loading}
                        isLoading={loading}
                        loadingText=""
                        onClick={() => void handleInstallGitHubApp()}
                        size="icon"
                        type="button"
                        variant="ghost"
                      >
                        <Plus />
                      </LoadingButton>
                    </AppTooltip>
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-0.5">
                {isFetchingMyRepos ? (
                  <div className="h-70 rounded-xl border p-1">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div className="flex flex-col gap-1 p-3" key={i}>
                        <div className="flex items-center justify-between">
                          <Skeleton className="h-3.5 w-32" />
                          <Skeleton className="h-4 w-24" />
                        </div>
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-4 w-48" />
                      </div>
                    ))}
                  </div>
                ) : myGithubData == null ? (
                  <div className="h-70 rounded-xl border p-1">
                    <div className="flex h-full flex-col items-center justify-center p-4 text-center">
                      <p className="mb-3 text-muted-foreground text-sm">
                        Failed to load repositories.
                      </p>
                      <AppButton
                        className="h-8 gap-2"
                        onClick={() => void refetchMyRepos()}
                        size="sm"
                        type="button"
                        variant="outline"
                      >
                        <RefreshCcw className="h-3.5 w-3.5" /> Retry
                      </AppButton>
                    </div>
                  </div>
                ) : !myGithubData.isConnected ? (
                  <div className="h-70 rounded-xl border p-1">
                    <div className="flex h-full flex-col items-center justify-center px-2 xs:px-4 py-4 xs:py-8 text-center">
                      <p className="mb-3 text-muted-foreground text-sm">
                        First, you need to link your GitHub profile.
                      </p>
                      <LoadingButton
                        className="cursor-pointer"
                        disabled={loadingOauth}
                        isLoading={loadingOauth}
                        loadingText="Processing..."
                        onClick={() => void handleSignIn()}
                        type="button"
                        variant="outline"
                      >
                        <GitHubIcon /> Link
                      </LoadingButton>
                    </div>
                  </div>
                ) : oauthStatus === "invalid" ? (
                  <div className="h-70 rounded-xl border p-1">
                    <div className="flex h-full flex-col items-center justify-center px-2 xs:px-4 py-4 xs:py-8 text-center">
                      <p className="mb-3 text-muted-foreground text-sm">
                        Your GitHub authorization expired. Please relink your account.
                      </p>
                      <LoadingButton
                        className="cursor-pointer"
                        disabled={loadingOauth}
                        isLoading={loadingOauth}
                        loadingText="Processing..."
                        onClick={() => void handleSignIn()}
                        type="button"
                        variant="outline"
                      >
                        <GitHubIcon /> Relink
                      </LoadingButton>
                    </div>
                  </div>
                ) : (
                  <ScrollArea className="h-70 rounded-xl border p-1" type="always">
                    {myGithubData.items.length > 0 && myGithubData.installations?.length === 0 && (
                      <div className="flex h-full flex-col items-center justify-center px-2 xs:px-4 py-4 xs:py-8 text-center">
                        <p className="mb-3 text-muted-foreground text-sm">
                          Want private and org repositories? Install our GitHub App!
                        </p>
                        <LoadingButton
                          className="cursor-pointer"
                          disabled={loading}
                          isLoading={loading}
                          loadingText="Connecting..."
                          onClick={() => void handleInstallGitHubApp()}
                          type="button"
                          variant="outline"
                        >
                          <GitHubIcon /> Install
                        </LoadingButton>
                      </div>
                    )}

                    {myGithubData.items.length === 0 ? (
                      <div className="flex h-full flex-col items-center justify-center px-2 xs:px-4 py-4 xs:py-8 text-center">
                        {myGithubData.installations?.length === 0 ? (
                          <>
                            <p className="mb-3 font-medium text-muted-foreground text-sm">
                              Install our GitHub App to grant access to your repositories.
                            </p>
                            <LoadingButton
                              disabled={loading}
                              isLoading={loading}
                              onClick={() => void handleInstallGitHubApp()}
                              type="button"
                              variant="outline"
                            >
                              <GitHubIcon /> Install App
                            </LoadingButton>
                          </>
                        ) : (
                          <p className="flex h-full items-center justify-center p-4 text-center text-muted-foreground text-sm">
                            No repositories found. Ensure you granted access to them.
                          </p>
                        )}
                      </div>
                    ) : (
                      myGithubData.items.map((myRepo) => (
                        <RepoItem
                          disabled={create.isPending}
                          key={myRepo.fullName}
                          onClick={() => handleSelectRepo(myRepo.fullName)}
                          repo={myRepo}
                        />
                      ))
                    )}
                  </ScrollArea>
                )}
              </div>
            </div>
            <DialogFooter>
              <LoadingButton
                className="cursor-pointer"
                disabled={create.isPending || !form.formState.isValid || !urlValue}
                isLoading={create.isPending}
                loadingText="Adding..."
              >
                {tCommon("add")}
              </LoadingButton>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
