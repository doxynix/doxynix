"use client";
import { type CSSProperties, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { isTRPCClientError } from "@trpc/client";
import { ChevronRight, Eye, EyeOff, FileIcon, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";

import { useTRPC } from "@/shared/api/trpc";
import { useErrorMessage } from "@/shared/i18n/use-error-message";
import type { ShikiToken, ShikiTokenLines } from "@/shared/lib/client-shiki";
import { cn } from "@/shared/lib/cn";
import { useShikiTokenLines } from "@/shared/lib/hooks/use-shiki-highlight";
import { AppBadge } from "@/shared/ui/core/badge";
import { AppButton } from "@/shared/ui/core/button";
import { SkeletonText } from "@/shared/ui/kit/app-skeleton";
import { AppTooltip } from "@/shared/ui/kit/app-tooltip";
import { LoadingButton } from "@/shared/ui/kit/loading-button";

import { buildFileDiff, type FileDiffRow } from "../model/file-diff";

const EXTENSION_OVERRIDES: Record<string, string> = {
  h: "c",
  hpp: "cpp",
  text: "text",
  txt: "text",
};

function languageFromPath(path: string): string {
  const base = path.split("/").pop()?.toLowerCase() ?? "";
  const extension = base.includes(".") ? (base.split(".").pop() ?? base) : base;

  return EXTENSION_OVERRIDES[extension] ?? extension;
}

function tokenStyle(token: ShikiToken): CSSProperties {
  const fontStyle = token.fontStyle ?? 0;
  const textDecoration = [fontStyle & 4 ? "underline" : "", fontStyle & 8 ? "line-through" : ""]
    .filter(Boolean)
    .join(" ");

  return {
    backgroundColor: token.bgColor,
    color: token.color,
    fontStyle: fontStyle & 1 ? "italic" : undefined,
    fontWeight: fontStyle & 2 ? 700 : undefined,
    textDecoration: textDecoration === "" ? undefined : textDecoration,
  };
}

function renderTokens(tokens: ShikiToken[] | undefined, fallback: string) {
  if (tokens == null || tokens.length === 0) {
    return fallback;
  }

  return tokens.map((token, index) => (
    <span
      key={index}
      style={tokenStyle(token)}
    >
      {token.content}
    </span>
  ));
}

function tokensForRow(
  row: FileDiffRow,
  oldTokens: ShikiTokenLines | null,
  newTokens: ShikiTokenLines | null,
): ShikiToken[] | undefined {
  if (row.kind === "hunk") {
    return undefined;
  }

  if (row.kind === "remove") {
    return row.oldLine == null ? undefined : oldTokens?.[row.oldLine - 1];
  }

  return row.newLine == null ? undefined : newTokens?.[row.newLine - 1];
}

type FileMeta = {
  additions: number;
  deletions: number;
  isNewFile: boolean;
};

type Props = {
  file: { content: string; filePath: string };
  isHidden: boolean;
  isRemoving: boolean;
  onToggleHidden: () => void;
  onUnstage: () => void;
  repoId: string;
};

type BodyProps = {
  file: { content: string; filePath: string };
  isExpanded: boolean;
  onMetaChange: (meta: FileMeta) => void;
  repoId: string;
};

const rowTone: Record<FileDiffRow["kind"], string> = {
  add: "bg-success/10",
  context: "",
  hunk: "bg-muted text-muted-foreground",
  remove: "bg-destructive/10",
};

const markerForRow = (row: FileDiffRow): string => {
  if (row.kind === "add") {
    return "+";
  }
  if (row.kind === "remove") {
    return "−";
  }
  return "";
};

const keyForRow = (row: FileDiffRow): string => {
  if (row.kind === "hunk") {
    return row.header;
  }
  return `${row.kind}-${row.oldLine ?? "x"}-${row.newLine ?? "x"}`;
};

export function StagedFileDiff({
  file,
  isHidden,
  isRemoving,
  onToggleHidden,
  onUnstage,
  repoId,
}: Readonly<Props>) {
  const t = useTranslations("Dashboard");
  const tCommon = useTranslations("Common");
  const [isExpanded, setIsExpanded] = useState(false);
  const [meta, setMeta] = useState<FileMeta | null>(null);

  return (
    <div className={cn("overflow-hidden rounded-xl border", isHidden && "opacity-60")}>
      <div className="flex items-center justify-between gap-2 border-b bg-muted/40 px-2 py-1.5">
        <AppButton
          aria-expanded={isExpanded}
          className="h-7 min-w-0 flex-1 justify-start gap-2 px-1"
          onClick={() => setIsExpanded((prev) => !prev)}
          size="sm"
          variant="ghost"
        >
          <ChevronRight className={cn("transition-transform", isExpanded && "rotate-90")} />
          <FileIcon className="shrink-0 text-muted-foreground" />
          <span className="min-w-0 truncate font-mono text-xs">{file.filePath}</span>
          {meta?.isNewFile && (
            <AppBadge
              className="shrink-0 text-2xs"
              variant="outline"
            >
              {t("repo_pr_draft_new_file")}
            </AppBadge>
          )}
        </AppButton>
        <div className="flex shrink-0 items-center gap-2">
          {meta != null && (
            <>
              <span className="font-mono text-success text-xs">+{meta.additions}</span>
              <span className="font-mono text-destructive text-xs">−{meta.deletions}</span>
            </>
          )}
          <AppTooltip content={isHidden ? tCommon("show") : tCommon("hide")}>
            <AppButton
              aria-label={isHidden ? tCommon("show") : tCommon("hide")}
              onClick={onToggleHidden}
              size="icon"
              variant="ghost"
            >
              {isHidden ? <EyeOff /> : <Eye />}
            </AppButton>
          </AppTooltip>
          <LoadingButton
            aria-label={t("repo_pr_draft_unstage_aria")}
            className="hover:bg-destructive/10 hover:text-destructive"
            disabled={isRemoving}
            isLoading={isRemoving}
            onClick={onUnstage}
            size="icon"
            variant="ghost"
          >
            <Trash2 />
          </LoadingButton>
        </div>
      </div>

      {isExpanded && (
        <StagedFileDiffBody
          file={file}
          isExpanded={isExpanded}
          onMetaChange={setMeta}
          repoId={repoId}
        />
      )}
    </div>
  );
}

function StagedFileDiffBody({ file, isExpanded, onMetaChange, repoId }: Readonly<BodyProps>) {
  const trpc = useTRPC();
  const t = useTranslations("Dashboard");
  const errorMessage = useErrorMessage();

  const { data, error, isLoading } = useQuery(
    trpc.githubBrowse.getFileContent.queryOptions(
      { path: file.filePath, repoId },
      { enabled: isExpanded, retry: false },
    ),
  );

  // A GitHub 404 means the path is not on the default branch yet, so the staged file is new:
  // diff it against an empty string. The repo itself is already loaded on this screen.
  const isNewFile = isTRPCClientError(error) && error.data?.code === "NOT_FOUND";
  const oldContent = data?.content ?? (isNewFile ? "" : undefined);
  const diff = oldContent == null ? null : buildFileDiff(oldContent, file.content);
  const language = languageFromPath(file.filePath);
  const hasRows = oldContent != null && oldContent !== file.content;
  const oldSource = oldContent?.replaceAll("\r\n", "\n") ?? "";
  const newSource = file.content.replaceAll("\r\n", "\n");
  const oldTokens = useShikiTokenLines(oldSource, language, hasRows);
  const newTokens = useShikiTokenLines(newSource, language, hasRows);

  const additions = diff?.additions ?? null;
  const deletions = diff?.deletions ?? null;

  useEffect(() => {
    if (additions == null) {
      return;
    }
    onMetaChange({ additions, deletions: deletions ?? 0, isNewFile });
  }, [additions, deletions, isNewFile, onMetaChange]);

  return (
    <div className="font-mono text-xs">
      {isLoading ? (
        <SkeletonText
          className="p-3"
          lines={6}
          size="sm"
        />
      ) : error != null && !isNewFile ? (
        <p className="p-3 text-muted-foreground">{errorMessage(error)}</p>
      ) : diff == null || diff.rows.length === 0 ? (
        <p className="p-3 text-muted-foreground">{t("repo_pr_draft_no_diff")}</p>
      ) : (
        <div className="min-w-0">
          {diff.rows.map((row) =>
            row.kind === "hunk" ? (
              <div
                className={cn("px-3 py-1 text-2xs", rowTone[row.kind])}
                key={keyForRow(row)}
              >
                {row.header}
              </div>
            ) : (
              <div
                className={cn("flex", rowTone[row.kind])}
                key={keyForRow(row)}
              >
                <span className="w-10 shrink-0 select-none border-r px-2 text-right text-muted-foreground/60">
                  {row.oldLine ?? ""}
                </span>
                <span className="w-10 shrink-0 select-none border-r px-2 text-right text-muted-foreground/60">
                  {row.newLine ?? ""}
                </span>
                <span className="w-5 shrink-0 select-none text-center">{markerForRow(row)}</span>
                <span className="min-w-0 flex-1 whitespace-pre-wrap break-words pr-3">
                  {renderTokens(tokensForRow(row, oldTokens, newTokens), row.content)}
                </span>
              </div>
            ),
          )}
        </div>
      )}
    </div>
  );
}
