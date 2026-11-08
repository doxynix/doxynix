"use client";

import { type ComponentType, useEffect, useState } from "react";
import { diagnosticCount } from "@codemirror/lint";
import { getSearchQuery, setSearchQuery } from "@codemirror/search";
import { EditorState, type Extension } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";
import { githubDark, githubLight } from "@uiw/codemirror-theme-github";
import CodeMirror from "@uiw/react-codemirror";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import CodeMirrorMerge from "react-codemirror-merge";

import { buildEditorExtensions } from "../model/editor-extensions";
import { loadLanguageExtension } from "../model/editor-language-loader";
import { isReadOnly, type RepoCodeDiff, type RepoCodeMode } from "../model/editor-mode";
import type { EditorStats } from "../model/editor-stats.types";

type Props = {
  diff?: RepoCodeDiff;
  initialValue?: string;
  mode: RepoCodeMode;
  onChange?: (v: string) => void;
  onStats?: (stats: EditorStats) => void;
  onViewCreated?: (view: EditorView) => void;
  path: string;
  value: string;
};

export function RepoCodeEditor({
  diff,
  initialValue,
  mode,
  onChange,
  onStats,
  onViewCreated,
  path,
  value,
}: Readonly<Props>) {
  const t = useTranslations("Dashboard");
  const [ext, setExt] = useState<Extension[]>(() =>
    buildEditorExtensions({ syntaxError: t("editor_syntax_error") }),
  );
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    let cancelled = false;
    async function loadDynamicLanguage() {
      const baseExtensions = buildEditorExtensions({ syntaxError: t("editor_syntax_error") });
      const dynamicExt: Extension[] = [...baseExtensions];

      try {
        const languageSupport = await loadLanguageExtension(path);

        if (languageSupport) {
          dynamicExt.push(languageSupport);
        }

        if (!cancelled) {
          setExt(dynamicExt);
        }
      } catch (error) {
        console.error("Failed to load language support", error);
        if (!cancelled) {
          setExt(baseExtensions);
        }
      }
    }

    void loadDynamicLanguage();
    return () => {
      cancelled = true;
    };
  }, [path, t]);

  const readOnly = isReadOnly(mode);
  const mergeExtensionsReadOnly = [...ext, EditorState.readOnly.of(true)];
  const mergeExtensionsEditable = readOnly ? mergeExtensionsReadOnly : ext;

  const Merge = CodeMirrorMerge as unknown as {
    Modified?: ComponentType<Record<string, unknown>>;
    Original?: ComponentType<Record<string, unknown>>;
  };
  const Original = Merge.Original;
  const Modified = Merge.Modified;

  if (diff != null && Original && Modified) {
    return (
      <div className="group relative h-full w-full">
        <CodeMirrorMerge
          className="cm-merge-container h-full w-full flex-1"
          collapseUnchanged={{ margin: 3, minSize: 4 }}
          gutter
          highlightChanges
          theme={githubDark}
        >
          <Original
            basicSetup={false}
            className="h-full text-xs"
            editable={false}
            extensions={mergeExtensionsReadOnly}
            readOnly
            value={diff.originalValue}
          />
          <Modified
            basicSetup={false}
            className="h-full text-xs"
            extensions={mergeExtensionsEditable}
            onChange={onChange}
            readOnly={readOnly}
            value={value}
          />
        </CodeMirrorMerge>

        <style
          dangerouslySetInnerHTML={{
            __html: `
          .cm-merge-container {
            height: 100% !important;
            width: 100% !important;
          }
          .cm-merge-container .cm-mergeView {
            height: 100% !important;
          }
          .cm-merge-container .cm-mergeView-editor {
            height: 100% !important;
          }
          .cm-merge-container .cm-editor {
            height: 100% !important;
          }
          .cm-merge-container .cm-scroller {
            overflow: auto !important;
          }
        `,
          }}
        />
      </div>
    );
  }

  return (
    <div className="group relative h-full w-full">
      <CodeMirror
        basicSetup={false}
        className="h-full text-xs"
        extensions={ext}
        height="100%"
        onChange={onChange}
        onCreateEditor={(view) => {
          onViewCreated?.(view);
        }}
        onUpdate={(update) => {
          const searchChanged = update.transactions.some((tr) =>
            tr.effects.some((e) => e.is(setSearchQuery)),
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
        readOnly={readOnly}
        theme={resolvedTheme === "dark" ? githubDark : githubLight}
        value={value}
      />
    </div>
  );
}
