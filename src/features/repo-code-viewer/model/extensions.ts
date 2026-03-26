import {
  autocompletion,
  closeBrackets,
  closeBracketsKeymap,
  completionKeymap,
} from "@codemirror/autocomplete";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import {
  bracketMatching,
  codeFolding,
  defaultHighlightStyle,
  foldGutter,
  foldKeymap,
  indentOnInput,
  indentUnit,
  syntaxHighlighting,
  syntaxTree,
} from "@codemirror/language";
import { linter, lintGutter, lintKeymap, type Diagnostic } from "@codemirror/lint";
import { highlightSelectionMatches, search } from "@codemirror/search";
import { EditorState, RangeSetBuilder, type Extension } from "@codemirror/state";
import {
  crosshairCursor,
  Decoration,
  drawSelection,
  dropCursor,
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  highlightSpecialChars,
  keymap,
  lineNumbers,
  rectangularSelection,
  tooltips,
  ViewPlugin,
  type DecorationSet,
  type ViewUpdate,
} from "@codemirror/view";
import { color } from "@uiw/codemirror-extensions-color";
import { hyperLink } from "@uiw/codemirror-extensions-hyper-link";

const TAG_REGEX = /\b(TODO|FIXME|BUG|HACK|NOTE|XXX)\b/gi;

function buildTodoDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  const tree = syntaxTree(view.state);
  let hasCommentNodes = false as boolean;

  for (const { from, to } of view.visibleRanges) {
    tree.iterate({
      enter: (node) => {
        if (!node.type.name.includes("Comment")) return;
        hasCommentNodes = true;
        const visibleFrom = Math.max(node.from, from);
        const visibleTo = Math.min(node.to, to);
        if (visibleFrom >= visibleTo) return;
        const text = view.state.doc.sliceString(visibleFrom, visibleTo);
        TAG_REGEX.lastIndex = 0;

        for (const match of text.matchAll(TAG_REGEX)) {
          const word = (match[1] || match[0]).toUpperCase();
          const urgent = word === "FIXME" || word === "BUG" || word === "XXX";
          const start = visibleFrom + match.index;
          const end = start + match[0].length;
          const className = urgent
            ? "cm-todo-marker cm-todo-urgent"
            : word === "NOTE"
              ? "cm-note-marker"
              : "cm-todo-marker";
          builder.add(start, end, Decoration.mark({ class: className }));
        }
      },
      from,
      to,
    });
  }

  if (!hasCommentNodes) {
    for (const { from, to } of view.visibleRanges) {
      const text = view.state.doc.sliceString(from, to);
      TAG_REGEX.lastIndex = 0;

      for (const match of text.matchAll(TAG_REGEX)) {
        const word = (match[1] || match[0]).toUpperCase();
        const urgent = word === "FIXME" || word === "BUG" || word === "XXX";
        const start = from + match.index;
        const end = start + match[0].length;
        const className = urgent
          ? "cm-todo-marker cm-todo-urgent"
          : word === "NOTE"
            ? "cm-note-marker"
            : "cm-todo-marker";
        builder.add(start, end, Decoration.mark({ class: className }));
      }
    }
  }

  return builder.finish();
}

const todoHighlighter = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = buildTodoDecorations(view);
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = buildTodoDecorations(update.view);
      }
    }
  },
  {
    decorations: (v) => v.decorations,
  }
);

const universalSyntaxLinter = linter((view) => {
  const diagnostics: Diagnostic[] = [];

  syntaxTree(view.state)
    .cursor()
    .iterate((node) => {
      if (node.type.isError) {
        diagnostics.push({
          from: node.from,
          message: "Syntax Error: Unexpected token or parsing failed",
          severity: "error",
          to: node.to,
        });
      }
    });

  return diagnostics;
});

export const EXTRA_EXTENSIONS: Extension[] = [
  // zebraStripes({ step: 2 }), // пустые строки подсвечивает выглядит странно
  color,
  hyperLink,
  search({ top: true }),

  todoHighlighter,

  lineNumbers(),
  highlightActiveLineGutter(),
  highlightSpecialChars(),
  drawSelection(),
  dropCursor(),
  rectangularSelection(),
  crosshairCursor(),
  highlightActiveLine(),
  // highlightWhitespace(), // штука для точек при отступах выглядит не очень
  // highlightTrailingWhitespace(),
  // scrollPastEnd(),
  tooltips({ position: "absolute" }),
  EditorView.lineWrapping,

  EditorView.contentAttributes.of({ spellcheck: "false" }),

  EditorState.tabSize.of(2),
  indentUnit.of("  "),
  EditorState.allowMultipleSelections.of(true),
  bracketMatching(),
  foldGutter(),
  codeFolding(),
  indentOnInput(),
  syntaxHighlighting(defaultHighlightStyle, { fallback: true }),

  autocompletion(),
  closeBrackets(),
  highlightSelectionMatches(),
  history(),

  lintGutter(),
  universalSyntaxLinter,

  keymap.of([
    indentWithTab,
    ...defaultKeymap,
    ...historyKeymap,
    ...foldKeymap,
    ...completionKeymap,
    ...closeBracketsKeymap,
    ...lintKeymap,
  ]),

  EditorView.theme({
    "&": {
      backgroundColor: "var(--background)",
      color: "var(--foreground)",
      fontSize: "13px",
      height: "100%",
    },
    "&.cm-focused .cm-cursor": { borderLeftColor: "var(--primary)" },
    ".close-btn": {
      "&:hover": {
        backgroundColor: "color-mix(in srgb, var(--status-error), transparent 90%)",
        color: "var(--status-error)",
      },
      color: "var(--text-muted)",
    },
    ".cm-activeLine": { backgroundColor: "var(--surface-hover)" },
    ".cm-activeLineGutter": {
      backgroundColor: "var(--surface-hover)",
      color: "var(--text-primary)",
    },
    ".cm-cursor": { borderLeftColor: "var(--primary)", borderLeftWidth: "2px" },
    ".cm-gutters": {
      backgroundColor: "var(--surface-subtle)",
      borderRight: "1px solid var(--border-soft)",
      color: "var(--text-muted)",
      minWidth: "40px",
    },

    ".cm-hover-scanner": {
      backgroundColor: "var(--surface-panel)",
      border: "1px solid var(--border-strong)",
      borderRadius: "var(--radius-md)",
      boxShadow: "var(--shadow-md)",
      color: "var(--brand-docs)",
      fontFamily: "var(--font-mono)",
      fontSize: "11px",
      padding: "6px 10px",
    },
    ".cm-mergeView": { height: "100%" },
    ".cm-mergeView .cm-scroller": { overflow: "auto" },
    ".cm-note-marker": {
      backgroundColor: "color-mix(in srgb, var(--status-info), transparent 80%)",
      border: "1px solid color-mix(in srgb, var(--status-info), transparent 60%)",
      borderRadius: "3px",
      color: "var(--status-info)",
      fontWeight: "700",
      padding: "0 2px",
    },
    ".cm-scroller": {
      fontFamily: "var(--font-mono)",
      scrollbarWidth: "thin",
    },

    ".cm-search": { display: "none !important" },

    ".cm-searchMatch": {
      backgroundColor: "color-mix(in srgb, var(--status-success), transparent 70%)",
      outline: "1px solid var(--status-success)",
    },
    ".cm-searchMatch.cm-searchMatch-selected": {
      backgroundColor: "var(--status-warning)",
      outline: "1px solid var(--text-primary)",
    },

    ".cm-todo-marker": {
      backgroundColor: "color-mix(in srgb, var(--status-warning), transparent 80%)",
      borderRadius: "3px",
      color: "var(--status-warning)",
      fontWeight: "700",
      padding: "0 2px",
    },

    ".cm-todo-urgent": {
      backgroundColor: "color-mix(in srgb, var(--status-error), transparent 80%)",
      border: "1px solid color-mix(in srgb, var(--status-error), transparent 60%)",
      borderRadius: "3px",
      color: "var(--status-error)",
      fontWeight: "700",
      padding: "0 2px",
    },

    ".icon-btn": { fontWeight: "bold", padding: "6px 10px" },

    ".is-edit": {
      backgroundColor: "color-mix(in srgb, var(--status-success), transparent 85%)",
      borderColor: "color-mix(in srgb, var(--status-success), transparent 60%)",
      color: "var(--status-success)",
    },

    ".is-readonly": {
      backgroundColor: "var(--surface-subtle)",
      borderColor: "var(--border-soft)",
      color: "var(--text-muted)",
    },
    ".search-group, .replace-group": { alignItems: "center", display: "flex", gap: "8px" },
  }),
];
