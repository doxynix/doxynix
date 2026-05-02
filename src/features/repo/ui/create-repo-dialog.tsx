"use client";

import { useRef, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Book, Plus, RefreshCcw } from "lucide-react";
import { signIn } from "next-auth/react";
import { useTranslations } from "next-intl";
import { useQueryState } from "nuqs";
import posthog from "posthog-js";
import { useForm, useWatch } from "react-hook-form";
import { useDebounce } from "use-debounce";

import { CreateRepoSchema, type CreateRepoInput } from "@/shared/api/schemas/repo";
import { trpc } from "@/shared/api/trpc";
import { useClickOutside } from "@/shared/hooks/use-click-outside";
import { isGitHubUrl } from "@/shared/lib/github-url";
import { Button } from "@/shared/ui/core/button";
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
  const { refetch: getInstallUrl } = trpc.githubApp.getGithubInstallUrl.useQuery(undefined, {
    enabled: false,
  });

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
  const [debouncedValue] = useDebounce(urlValue, 300);

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
    }
  );

  const {
    data: myGithubData,
    isFetching: isFetchingMyRepos,
    refetch: refetchMyRepos,
  } = trpc.githubApp.getMyGithubRepos.useQuery(undefined, {
    enabled: open,
    staleTime: STALE_TIME,
  });

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
      await signIn("github", { callbackUrl: "/dashboard" });
    } catch (error) {
      console.error(error);
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
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("repo_add_repository")}</DialogTitle>
          <DialogDescription>{t("repo_create_desc")} </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={(e) => void form.handleSubmit(onSubmit)(e)} className="grid gap-4 py-4">
            <div ref={containerRef} className="flex flex-col gap-3">
              <FormField
                name="url"
                control={form.control}
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
                          disabled={create.isPending}
                          maxLength={500}
                          placeholder={t("repo_create_placeholder")}
                          onChange={(e) => {
                            field.onChange(e);
                            setShowSuggestions(true);
                          }}
                          onClick={() => setShowSuggestions(true)}
                          onFocus={() => setShowSuggestions(true)}
                          className="pl-8 text-sm"
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                    {showSuggestions && suggestions && suggestions.length > 0 && (
                      <div className="bg-popover text-popover-foreground absolute top-full right-0 left-0 z-10 mt-1 h-80 overflow-y-auto rounded-xl border">
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
              <div className="flex items-center justify-between text-xs font-medium tracking-wider">
                <div className="text-muted-foreground flex items-center gap-2 uppercase">
                  <Book className="size-3" />
                  {t("repo_your_repos")}
                </div>

                {myGithubData?.installations != null && myGithubData.installations.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {myGithubData.installations.map((inst) => (
                      <AppTooltip key={inst.id} content={inst.login}>
                        <ExternalLink
                          href={inst.manageUrl ?? ""}
                          className="flex items-center gap-1 hover:underline"
                        >
                          <AppAvatar alt={inst.login} sizeClassName="size-6" src={inst.avatar} />
                        </ExternalLink>
                      </AppTooltip>
                    ))}
                    <AppTooltip content="Add new">
                      <LoadingButton
                        type="button"
                        disabled={loading}
                        isLoading={loading}
                        loadingText=""
                        size="icon"
                        variant="ghost"
                        onClick={() => void handleInstallGitHubApp()}
                        className="size-6"
                      >
                        <Plus />
                      </LoadingButton>
                    </AppTooltip>
                  </div>
                )}
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
                ) : myGithubData == null ? (
                  <div className="h-70 rounded-xl border p-1">
                    <div className="flex h-full flex-col items-center justify-center p-4 text-center">
                      <p className="text-muted-foreground mb-3 text-sm">
                        Failed to load repositories.
                      </p>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => void refetchMyRepos()}
                        className="h-8 gap-2"
                      >
                        <RefreshCcw className="h-3.5 w-3.5" /> Retry
                      </Button>
                    </div>
                  </div>
                ) : myGithubData.isConnected === false ? (
                  <div className="h-70 rounded-xl border p-1">
                    <div className="xs:px-4 xs:py-8 flex h-full flex-col items-center justify-center px-2 py-4 text-center">
                      <p className="text-muted-foreground mb-3 text-sm">
                        First, you need to link your GitHub profile.
                      </p>
                      <LoadingButton
                        type="button"
                        disabled={loadingOauth}
                        isLoading={loadingOauth}
                        loadingText="Processing..."
                        variant="outline"
                        onClick={() => void handleSignIn()}
                        className="cursor-pointer"
                      >
                        <GitHubIcon /> Link
                      </LoadingButton>
                    </div>
                  </div>
                ) : oauthStatus === "invalid" ? (
                  <div className="h-70 rounded-xl border p-1">
                    <div className="xs:px-4 xs:py-8 flex h-full flex-col items-center justify-center px-2 py-4 text-center">
                      <p className="text-muted-foreground mb-3 text-sm">
                        Your GitHub authorization expired. Please relink your account.
                      </p>
                      <LoadingButton
                        type="button"
                        disabled={loadingOauth}
                        isLoading={loadingOauth}
                        loadingText="Processing..."
                        variant="outline"
                        onClick={() => void handleSignIn()}
                        className="cursor-pointer"
                      >
                        <GitHubIcon /> Relink
                      </LoadingButton>
                    </div>
                  </div>
                ) : (
                  <ScrollArea type="always" className="h-70 rounded-xl border p-1">
                    {myGithubData.items.length > 0 && myGithubData.installations?.length === 0 && (
                      <div className="xs:px-4 xs:py-8 flex h-full flex-col items-center justify-center px-2 py-4 text-center">
                        <p className="text-muted-foreground mb-3 text-sm">
                          Want private and org repositories? Install our GitHub App!
                        </p>
                        <LoadingButton
                          type="button"
                          disabled={loading}
                          isLoading={loading}
                          loadingText="Connecting..."
                          variant="outline"
                          onClick={() => void handleInstallGitHubApp()}
                          className="cursor-pointer"
                        >
                          <GitHubIcon /> Install
                        </LoadingButton>
                      </div>
                    )}

                    {myGithubData.items.length === 0 ? (
                      <div className="xs:px-4 xs:py-8 flex h-full flex-col items-center justify-center px-2 py-4 text-center">
                        {myGithubData.installations?.length === 0 ? (
                          <>
                            <p className="text-muted-foreground mb-3 text-sm font-medium">
                              Install our GitHub App to grant access to your repositories.
                            </p>
                            <LoadingButton
                              type="button"
                              disabled={loading}
                              isLoading={loading}
                              variant="outline"
                              onClick={() => void handleInstallGitHubApp()}
                            >
                              <GitHubIcon /> Install App
                            </LoadingButton>
                          </>
                        ) : (
                          <p className="text-muted-foreground flex h-full items-center justify-center p-4 text-center text-sm">
                            No repositories found. Ensure you granted access to them.
                          </p>
                        )}
                      </div>
                    ) : (
                      myGithubData.items.map((myRepo) => (
                        <RepoItem
                          key={myRepo.fullName}
                          disabled={create.isPending}
                          repo={myRepo}
                          onClick={() => handleSelectRepo(myRepo.fullName)}
                        />
                      ))
                    )}
                  </ScrollArea>
                )}
              </div>
            </div>
            <DialogFooter>
              <LoadingButton
                disabled={create.isPending || !form.formState.isValid || !urlValue}
                isLoading={create.isPending}
                loadingText="Adding..."
                className="cursor-pointer"
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
