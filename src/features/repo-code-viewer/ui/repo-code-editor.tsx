"use client";

import { useEffect, useState, type ComponentType } from "react";
import { diagnosticCount } from "@codemirror/lint";
import { getSearchQuery, setSearchQuery } from "@codemirror/search";
import { EditorState, type Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { githubDark, githubLight } from "@uiw/codemirror-theme-github";
import CodeMirror from "@uiw/react-codemirror";
import { useTheme } from "next-themes";
import CodeMirrorMerge from "react-codemirror-merge";

import type { FileMeta } from "@/shared/api/trpc";

import type { EditorStats } from "@/entities/repo-details";

import { EXTRA_EXTENSIONS } from "../model/extensions";

type Props = {
  compareValue?: string;
  initialValue?: string;
  meta: FileMeta;
  onChange?: (v: string) => void;
  onStats?: (stats: EditorStats) => void;
  onViewCreated?: (view: EditorView) => void;
  path: string;
  readOnly?: boolean;
  showDiff?: boolean;
  value: string;
};

export function RepoCodeEditor({
  compareValue,
  initialValue,
  meta,
  onChange,
  onStats,
  onViewCreated,
  path,
  readOnly = false,
  showDiff = false,
  value,
}: Readonly<Props>) {
  const [ext, setExt] = useState<Extension[]>(EXTRA_EXTENSIONS);
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    let cancelled = false;
    async function loadDynamicLanguage() {
      const extName = (path.split(".").pop() ?? "").toLowerCase();
      const dynamicExt: Extension[] = [...EXTRA_EXTENSIONS];

      try {
        const { languages } = await import("@codemirror/language-data");

        const langDesc = languages.find(
          (l) => l.extensions.includes(extName) || l.alias.includes(extName)
        );

        if (langDesc) {
          const languageSupport = await langDesc.load();
          dynamicExt.push(languageSupport);
        }

        if (!cancelled) {
          setExt(dynamicExt);
        }
      } catch (error) {
        console.error("Failed to load language support", error);
        if (!cancelled) {
          setExt(EXTRA_EXTENSIONS);
        }
      }
    }

    void loadDynamicLanguage();
    return () => {
      cancelled = true;
    };
  }, [path, meta, readOnly]);

  const isDiffMode = showDiff && compareValue != null;
  const mergeExtensionsReadOnly = [
    ...ext,
    EditorView.editable.of(false),
    EditorState.readOnly.of(true),
  ];
  const mergeExtensionsEditable = readOnly ? mergeExtensionsReadOnly : ext;

  const Merge = CodeMirrorMerge as unknown as {
    Modified?: ComponentType<Record<string, unknown>>;
    Original?: ComponentType<Record<string, unknown>>;
  };
  const Original = Merge.Original;
  const Modified = Merge.Modified;

  if (isDiffMode && Original && Modified) {
    return (
      <div className="group relative h-full w-full">
        <CodeMirrorMerge
          gutter
          highlightChanges
          collapseUnchanged={{ margin: 3, minSize: 4 }}
          theme={githubDark}
          className="h-full w-full"
        >
          <Original
            value={compareValue}
            readOnly
            basicSetup={false}
            editable={false}
            extensions={mergeExtensionsReadOnly}
            className="h-full text-xs"
          />
          <Modified
            value={value}
            basicSetup={false}
            editable={!readOnly}
            extensions={mergeExtensionsEditable}
            readOnly={readOnly}
            onChange={onChange}
            className="h-full text-xs"
          />
        </CodeMirrorMerge>
      </div>
    );
  }

  return (
    <div className="group relative h-full w-full">
      <CodeMirror
        value={value}
        basicSetup={false}
        editable={!readOnly}
        extensions={ext}
        height="100%"
        readOnly={readOnly}
        theme={resolvedTheme === "dark" ? githubDark : githubLight}
        onChange={onChange}
        onCreateEditor={(view) => {
          onViewCreated?.(view);
        }}
        onUpdate={(update) => {
          const searchChanged = update.transactions.some((tr) =>
            tr.effects.some((e) => e.is(setSearchQuery))
          );

          if (onStats && (update.docChanged || update.selectionSet || searchChanged)) {
            const { state } = update;
            const pos = state.selection.main.head;
            const query = getSearchQuery(state);
            const lineAt = state.doc.lineAt(pos);
            let totalMatches = 0;
            let currentMatch = 0;

            if (query.search !== "") {
              const cursor = query.getCursor(state.doc);
              const currentPos = state.selection.main.from;
              let match = cursor.next();

              while (match.done === false) {
                totalMatches++;
                if (match.value.from <= currentPos) {
                  currentMatch = totalMatches;
                }
                match = cursor.next();
              }
            }

            onStats({
              col: pos - lineAt.from + 1,
              currentMatch: totalMatches > 0 ? currentMatch : 0,
              errors: diagnosticCount(state),
              isDirty: state.doc.toString() !== (initialValue ?? value),
              line: lineAt.number,
              totalLines: state.doc.lines,
              totalMatches,
            });
          }
        }}
        className="h-full text-xs"
      />
    </div>
  );
}
