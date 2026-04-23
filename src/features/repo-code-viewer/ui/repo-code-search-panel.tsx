import { useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent } from "react";
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

import type { EditorStats } from "@/entities/repo-details";

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
        })
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
    <div className="bg-card border-border animate-in slide-in-from-top-2 flex flex-wrap items-center justify-between gap-4 border-b px-3 py-2 font-sans text-xs duration-200">
      <div className="flex items-center gap-2">
        <div className="relative">
          <Search className="text-muted-foreground absolute top-2 left-2.5 size-4" />
          <Input
            ref={inputRef}
            value={search}
            placeholder="Find..."
            onChange={onSearchChange}
            onKeyDown={(e) =>
              onKeyDown(e, () => (e.shiftKey ? findPrevious(view) : findNext(view)))
            }
            className="h-8 w-64 pr-21 pl-9 text-xs"
          />
          <kbd className="absolute top-0.5 right-1 flex items-center gap-0.5 bg-transparent p-0.5">
            <RepoCodeActionButton
              tooltipText="Match Case (Aa)"
              onClick={() => toggleOption("caseSensitive")}
              className={cn(
                "h-6 w-6 rounded-xl p-0 transition-all",
                options.caseSensitive
                  ? "bg-primary text-primary-foreground hover:bg-primary/90"
                  : "text-muted-foreground hover:bg-primary/90"
              )}
            >
              <CaseSensitive className="size-3.5" />
            </RepoCodeActionButton>
            <RepoCodeActionButton
              tooltipText="Whole Word (\bW\b)"
              onClick={() => toggleOption("wholeWord")}
              className={cn(
                "h-6 w-6 rounded-xl p-0 transition-all",
                options.wholeWord
                  ? "bg-primary text-primary-foreground hover:bg-primary/90"
                  : "text-muted-foreground hover:bg-primary/90"
              )}
            >
              <WholeWord className="size-3.5" />
            </RepoCodeActionButton>

            <RepoCodeActionButton
              tooltipText="Regular Expression (.*)"
              onClick={() => toggleOption("regexp")}
              className={cn(
                "h-6 w-6 rounded-xl p-0 transition-all",
                options.regexp
                  ? "bg-primary text-primary-foreground hover:bg-primary/90"
                  : "text-muted-foreground hover:bg-primary/90"
              )}
            >
              <span className="text-[10px] leading-none font-bold">.*</span>
            </RepoCodeActionButton>
          </kbd>
        </div>
        <p className="bg-muted/50 text-muted-foreground pointer-events-none rounded px-1.5 py-0.5 text-[10px] font-medium">
          {stats.totalMatches > 0 ? `${stats.currentMatch} of ${stats.totalMatches}` : "No results"}
        </p>
        <RepoCodeActionButton
          tooltipText="Previous match (Shift+Enter)"
          onClick={() => findPrevious(view)}
          className="h-8 w-8 p-0"
        >
          <MoveLeft className="size-4 rotate-90" />
        </RepoCodeActionButton>

        <RepoCodeActionButton
          tooltipText="Next match (Enter)"
          onClick={() => findNext(view)}
          className="h-8 w-8 p-0"
        >
          <MoveLeft className="size-4 -rotate-90" />
        </RepoCodeActionButton>
      </div>

      <div className="flex items-center gap-2">
        <Input
          value={replace}
          placeholder="Replace with..."
          onChange={onReplaceChange}
          onKeyDown={(e) => onKeyDown(e, () => replaceNext(view))}
          className="h-8 w-48 text-xs"
        />
        <RepoCodeActionButton
          tooltipText="Replace (Enter)"
          onClick={() => replaceNext(view)}
          className="h-8 px-2"
        >
          <Replace className="mr-1.5 size-4" />
          Replace
        </RepoCodeActionButton>

        <RepoCodeActionButton
          tooltipText="Replace all"
          onClick={() => replaceAll(view)}
          className="h-8 px-2"
        >
          <ReplaceAll className="mr-1.5 size-4" />
          All
        </RepoCodeActionButton>

        <RepoCodeActionButton
          tooltipText="Close (Esc)"
          onClick={onClose}
          className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 ml-2 h-8 w-8 p-0"
        >
          <X className="size-4" />
        </RepoCodeActionButton>
      </div>
    </div>
  );
}
