"use client";

import { useState } from "react";
import type { Route } from "next";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Star } from "lucide-react";
import { toast } from "sonner";
import { useDebounce } from "use-debounce";

import { trpc } from "@/shared/api/trpc";
import { Button } from "@/shared/ui/button";
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
import { Input } from "@/shared/ui/input";
import { LoadingButton } from "@/shared/ui/LoadingButton";
import { Spinner } from "@/shared/ui/spinner";

import { useCreateRepoDialogStore } from "../model/create-repo-dialog.store";

function isGitHubUrl(input: string): boolean {
  const trimmed = input.trim();
  if (!trimmed) {
    return false;
  }

  if (!/^https?:\/\//i.test(trimmed) && trimmed.includes("/")) {
    try {
      const normalized = `https://github.com/${trimmed.replace(/^\/+/, "")}`;
      const parsed = new URL(normalized);
      const hostname = parsed.hostname.toLowerCase();
      return hostname === "github.com" || hostname.endsWith(".github.com");
    } catch {
      return false;
    }
  }

  try {
    const parsed = new URL(trimmed);
    const hostname = parsed.hostname.toLowerCase();
    return hostname === "github.com" || hostname.endsWith(".github.com");
  } catch {
    return false;
  }
}

export function CreateRepoDialog() {
  const { open, closeDialog } = useCreateRepoDialogStore();
  const [url, setUrl] = useState("");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const utils = trpc.useUtils();
  const [debouncedValue] = useDebounce(url, 300);

  const isUrl = isGitHubUrl(url);
  const { data: suggestions, isFetching } = trpc.repo.searchGithub.useQuery(
    { query: debouncedValue },
    {
      enabled: debouncedValue.length >= 2 && !isUrl,
      staleTime: 1000 * 60 * 5,
    }
  );
  // подумать как отрисовать и стоит ли вообще список репозиториев юзера
  const { data: myRepos } = trpc.repo.getMyGithubRepos.useQuery(undefined, {
    enabled: open && url.length === 0,
  });

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
            <div className="flex flex-col gap-3">
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
                  onChange={(e) => setUrl(e.target.value)}
                  disabled={createRepo.isPending}
                  autoComplete="off"
                />
                {suggestions && suggestions.length > 0 && (
                  <div className="bg-popover absolute top-full right-0 left-0 z-20 mt-1">
                    {suggestions.map((repo) => (
                      <Button key={repo.fullName} variant="ghost" className="h-auto w-full">
                        <div
                          className="flex w-full cursor-pointer flex-col items-start gap-1"
                          onClick={() => setUrl(repo.fullName)}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{repo.fullName}</span>
                            <Star className="h-3 w-3 fill-current text-yellow-500" />{" "}
                            {repo.stars.toLocaleString("ru-RU")}
                          </div>
                          <span className="text-muted-foreground max-w-110 truncate text-xs">
                            {repo.description}
                          </span>
                        </div>
                      </Button>
                    ))}
                  </div>
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
