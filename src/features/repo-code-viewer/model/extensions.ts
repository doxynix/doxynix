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
    "&": { fontSize: "13px", height: "100%" },
    "&.cm-focused .cm-cursor": { borderLeftColor: "#58a6ff" },
    ".close-btn": {
      "&:hover": {
        backgroundColor: "rgba(255, 123, 114, 0.1)",
        borderColor: "transparent",
        color: "#ff7b72",
      },
      backgroundColor: "transparent",
      borderColor: "transparent",
      color: "#8b949e",
    },
    ".cm-activeLine": { backgroundColor: "#161b22" },
    ".cm-activeLineGutter": { backgroundColor: "#161b22", color: "#e6edf3" },
    ".cm-cursor": { borderLeftColor: "#58a6ff", borderLeftWidth: "2px" },
    ".cm-gutters": {
      backgroundColor: "#0d1117",
      borderRight: "1px solid #30363d",
      color: "#6e7681",
      minWidth: "40px",
    },

    ".cm-hover-scanner": {
      backgroundColor: "#0d1117",
      border: "1px solid #30363d",
      borderRadius: "6px",
      boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
      color: "#79c0ff",
      fontFamily: "var(--font-mono, monospace)",
      fontSize: "11px",
      padding: "6px 10px",
    },
    ".cm-mergeView": { height: "100%" },
    ".cm-mergeView .cm-scroller": { overflow: "auto" },
    ".cm-note-marker": {
      backgroundColor: "rgba(56, 139, 253, 0.15)",
      border: "1px solid rgba(56, 139, 253, 0.4)",
      borderRadius: "3px",
      color: "#58a6ff",
      fontWeight: "700",
      padding: "0 2px",
    },
    ".cm-scroller": { fontFamily: "var(--font-mono)", scrollbarWidth: "thin" },

    ".cm-search": { display: "none !important" },

    ".cm-searchMatch": { backgroundColor: "#3fb95055", outline: "1px solid #3fb950" },

    ".cm-searchMatch.cm-searchMatch-selected": {
      backgroundColor: "#9e6a03",
      outline: "1px solid #f2cc60",
    },
    ".cm-todo-marker": {
      backgroundColor: "rgba(242, 204, 96, 0.2)",
      borderRadius: "3px",
      color: "#f2cc60",
      fontWeight: "700",
      padding: "0 2px",
    },

    ".cm-todo-urgent": {
      backgroundColor: "rgba(248, 81, 73, 0.2)",
      border: "1px solid rgba(248, 81, 73, 0.35)",
      borderRadius: "3px",
      color: "#ff7b72",
      fontWeight: "700",
      padding: "0 2px",
    },

    ".icon-btn": { fontWeight: "bold", padding: "6px 10px" },

    ".is-edit": {
      backgroundColor: "rgba(35, 134, 54, 0.15)",
      borderColor: "rgba(46, 160, 67, 0.4)",
      color: "#3fb950",
    },

    ".is-readonly": {
      backgroundColor: "#21262d",
      borderColor: "#30363d",
      color: "#8b949e",
    },
    ".search-group, .replace-group": { alignItems: "center", display: "flex", gap: "8px" },
  }),
];
