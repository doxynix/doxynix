"use client";

import { useRef, useState } from "react";
import type { Route } from "next";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { BookOpen } from "lucide-react";
import { signIn } from "next-auth/react";
import { toast } from "sonner";
import { useDebounce } from "use-debounce";

import { trpc } from "@/shared/api/trpc";
import { useClickOutside } from "@/shared/hooks/use-click-outside";
import { isGitHubUrl } from "@/shared/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPortal,
  DialogTitle,
} from "@/shared/ui/dialog";
import GitHubIcon from "@/shared/ui/github-icon";
import GithubIcon from "@/shared/ui/github-icon";
import { Input } from "@/shared/ui/input";
import { LoadingButton } from "@/shared/ui/LoadingButton";
import { ScrollArea } from "@/shared/ui/scroll-area";
import { Skeleton } from "@/shared/ui/skeleton";
import { Spinner } from "@/shared/ui/spinner";

import { useCreateRepoDialogStore } from "../model/create-repo-dialog.store";
import { RepoItem } from "./RepoItem";

const STALE_TIME = 1000 * 60 * 5; // 5 минут

export function CreateRepoDialog() {
  const { open, closeDialog } = useCreateRepoDialogStore();
  const [url, setUrl] = useState("");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const utils = trpc.useUtils();
  const [debouncedValue] = useDebounce(url, 300);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  useClickOutside(containerRef, () => setShowSuggestions(false), open);

  async function handleConnectGithub() {
    try {
      setLoading(true);
      await signIn("github");
    } finally {
      setLoading(false);
    }
  }

  const isUrl = isGitHubUrl(url);
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

  const createRepo = trpc.repo.create.useMutation({
    onSuccess: async () => {
      toast.success("Репозиторий успешно добавлен");
      closeDialog();
      setUrl("");
      await utils.repo.getAll.invalidate();
      const params = new URLSearchParams(searchParams.toString());

      params.delete("page");
      router.push(`${pathname}?${params.toString()}` as Route);
      router.refresh();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) return;

    createRepo.mutate({ url });
  };

  const handleSelectRepo = (repoUrl: string) => {
    setUrl(repoUrl);
    setShowSuggestions(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && closeDialog()}>
      <DialogPortal>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Добавление репозитория</DialogTitle>
            <DialogDescription>
              Начните вводить имя репозитория или введите url репозитория или его имя для добавления
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="grid gap-4 py-4">
            <div className="flex flex-col gap-3" ref={containerRef}>
              <div className="relative">
                {isFetching ? (
                  <Spinner className="absolute top-2.5 left-2.5" />
                ) : (
                  <GitHubIcon className="absolute top-2.5 left-2.5" />
                )}
                <Input
                  id="repo-url"
                  className="pl-8"
                  placeholder="owner/repo или https://github.com/..."
                  value={url}
                  onChange={(e) => {
                    setUrl(e.target.value);
                    setShowSuggestions(true);
                  }}
                  onFocus={() => setShowSuggestions(true)}
                  onClick={() => setShowSuggestions(true)}
                  disabled={createRepo.isPending}
                  autoComplete="off"
                />
                {showSuggestions && suggestions && suggestions.length > 0 && (
                  <div className="bg-popover text-popover-foreground absolute top-full right-0 left-0 z-20 mt-1 h-80 overflow-y-auto rounded-md border shadow-md">
                    {suggestions.map((repo) => (
                      <RepoItem
                        key={repo.fullName}
                        repo={repo}
                        onClick={() => handleSelectRepo(repo.fullName)}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <div className="text-muted-foreground flex items-center gap-2 text-xs font-medium tracking-wider uppercase">
                <BookOpen className="h-3 w-3" /> Ваши репозитории
              </div>

              <div className="space-y-0.5">
                {isFetchingMyRepos ? (
                  <div className="h-70 rounded-md border p-1">
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
                  <div className="h-70 rounded-md border p-1">
                    <div className="flex h-full flex-col items-center justify-center px-4 py-8 text-center">
                      <p className="text-muted-foreground mb-3 text-sm">
                        Чтобы увидеть список своих репозиториев, подключите GitHub аккаунт
                      </p>
                      <LoadingButton
                        className="cursor-pointer"
                        variant="outline"
                        isLoading={loading}
                        loadingText="Подключение..."
                        disabled={loading}
                        onClick={() => handleConnectGithub()}
                      >
                        <GithubIcon /> Подключить
                      </LoadingButton>
                    </div>
                  </div>
                ) : (
                  <ScrollArea type="always" className="h-70 rounded-md border p-1">
                    {myGithubData?.items.map((myRepo) => (
                      <RepoItem
                        key={myRepo.fullName}
                        disabled={createRepo.isPending}
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
                isLoading={createRepo.isPending}
                loadingText="Добавление..."
                disabled={createRepo.isPending || !url}
              >
                Добавить
              </LoadingButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}
