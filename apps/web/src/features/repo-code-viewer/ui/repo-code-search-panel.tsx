import { type ChangeEvent, type KeyboardEvent, useEffect, useRef, useState } from "react";
import {
  findNext,
  findPrevious,
  getSearchQuery,
  replaceAll,
  replaceNext,
  SearchQuery,
  setSearchQuery,
} from "@codemirror/search";
import type { EditorView } from "@codemirror/view";
import { CaseSensitive, MoveLeft, Replace, ReplaceAll, Search, WholeWord, X } from "lucide-react";

import { cn } from "@/shared/lib/cn";
import { Input } from "@/shared/ui/core/input";

import type { EditorStats } from "@/entities/repo/model/editor-stats.types";

import { RepoCodeActionButton } from "./repo-code-action-button";

type Props = {
  onClose: () => void;
  stats: EditorStats;
  view: EditorView;
};

const onKeyDown = (e: KeyboardEvent, action: () => void) => {
  if (e.key === "Enter") {
    e.preventDefault();
    action();
  }
};

export function RepoSearchPanel({ onClose, stats, view }: Readonly<Props>) {
  const inputRef = useRef<HTMLInputElement>(null);
  const initialQuery = getSearchQuery(view.state);
  const [options, setOptions] = useState({
    caseSensitive: initialQuery.caseSensitive,
    regexp: initialQuery.regexp,
    wholeWord: initialQuery.wholeWord,
  });

  const [search, setSearch] = useState(initialQuery.search || "");
  const [replace, setReplace] = useState(initialQuery.replace || "");

  const [prevView, setPrevView] = useState(view);

  if (view !== prevView) {
    const q = getSearchQuery(view.state);
    setPrevView(view);
    setSearch(q.search);
    setReplace(q.replace);
    setOptions({
      caseSensitive: q.caseSensitive,
      regexp: q.regexp,
      wholeWord: q.wholeWord,
    });
  }

  useEffect(() => {
    const timer = setTimeout(() => inputRef.current?.focus(), 100);
    return () => clearTimeout(timer);
  }, []);

  const syncToCM = (s: string, r: string, opts = options) => {
    view.dispatch({
      effects: setSearchQuery.of(
        new SearchQuery({
          caseSensitive: opts.caseSensitive,
          regexp: opts.regexp,
          replace: r,
          search: s,
          wholeWord: opts.wholeWord,
        }),
      ),
    });
  };

  const toggleOption = (key: keyof typeof options) => {
    const nextOpts = { ...options, [key]: !options[key] };
    setOptions(nextOpts);
    syncToCM(search, replace, nextOpts);
  };

  const onSearchChange = (e: ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearch(val);
    syncToCM(val, replace);
  };

  const onReplaceChange = (e: ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setReplace(val);
    syncToCM(search, val);
  };

  return (
    <div className="slide-in-from-top-2 flex animate-in flex-wrap items-center justify-between gap-4 border-border border-b bg-card px-3 py-2 font-sans text-xs duration-200">
      <div className="flex items-center gap-2">
        <div className="relative">
          <Search className="absolute top-2 left-2.5 text-muted-foreground" />
          <Input
            className="h-8 w-64 pr-21 pl-9 text-xs"
            onChange={onSearchChange}
            onKeyDown={(e) =>
              onKeyDown(e, () => (e.shiftKey ? findPrevious(view) : findNext(view)))
            }
            placeholder="Find..."
            ref={inputRef}
            value={search}
          />
          <kbd className="absolute top-0.5 right-1 flex items-center gap-0.5 bg-transparent p-0.5">
            <RepoCodeActionButton
              className={cn(
                "h-6 w-6 rounded-xl p-0 transition-standard",
                options.caseSensitive
                  ? "bg-primary text-primary-foreground hover:bg-primary/90"
                  : "text-muted-foreground hover:bg-primary/90",
              )}
              onClick={() => toggleOption("caseSensitive")}
              tooltipText="Match Case (Aa)"
            >
              <CaseSensitive className="size-3.5" />
            </RepoCodeActionButton>
            <RepoCodeActionButton
              className={cn(
                "h-6 w-6 rounded-xl p-0 transition-standard",
                options.wholeWord
                  ? "bg-primary text-primary-foreground hover:bg-primary/90"
                  : "text-muted-foreground hover:bg-primary/90",
              )}
              onClick={() => toggleOption("wholeWord")}
              tooltipText="Whole Word (\bW\b)"
            >
              <WholeWord className="size-3.5" />
            </RepoCodeActionButton>

            <RepoCodeActionButton
              className={cn(
                "h-6 w-6 rounded-xl p-0 transition-standard",
                options.regexp
                  ? "bg-primary text-primary-foreground hover:bg-primary/90"
                  : "text-muted-foreground hover:bg-primary/90",
              )}
              onClick={() => toggleOption("regexp")}
              tooltipText="Regular Expression (.*)"
            >
              <span className="font-bold text-[10px] leading-none">.*</span>
            </RepoCodeActionButton>
          </kbd>
        </div>
        <p className="pointer-events-none rounded bg-muted px-1.5 py-0.5 font-medium text-[10px] text-muted-foreground">
          {stats.totalMatches > 0 ? `${stats.currentMatch} of ${stats.totalMatches}` : "No results"}
        </p>
        <RepoCodeActionButton
          className="h-8 w-8 p-0"
          onClick={() => findPrevious(view)}
          tooltipText="Previous match (Shift+Enter)"
        >
          <MoveLeft className="rotate-90" />
        </RepoCodeActionButton>

        <RepoCodeActionButton
          className="h-8 w-8 p-0"
          onClick={() => findNext(view)}
          tooltipText="Next match (Enter)"
        >
          <MoveLeft className="-rotate-90" />
        </RepoCodeActionButton>
      </div>

      <div className="flex items-center gap-2">
        <Input
          className="h-8 w-48 text-xs"
          onChange={onReplaceChange}
          onKeyDown={(e) => onKeyDown(e, () => replaceNext(view))}
          placeholder="Replace with..."
          value={replace}
        />
        <RepoCodeActionButton
          className="h-8 px-2"
          onClick={() => replaceNext(view)}
          tooltipText="Replace (Enter)"
        >
          <Replace className="mr-1.5" />
          Replace
        </RepoCodeActionButton>

        <RepoCodeActionButton
          className="h-8 px-2"
          onClick={() => replaceAll(view)}
          tooltipText="Replace all"
        >
          <ReplaceAll className="mr-1.5" />
          All
        </RepoCodeActionButton>

        <RepoCodeActionButton
          className="ml-2 h-8 w-8 p-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          onClick={onClose}
          tooltipText="Close (Esc)"
        >
          <X />
        </RepoCodeActionButton>
      </div>
    </div>
  );
}
