export type CodeStats = {
  comments: number;
  empty: number;
  source: number;
  todos: number;
  total: number;
};

type CommentSyntax = {
  blockEnd?: string;
  blockStart?: string;
  single?: string;
};

const C_LIKE_COMMENT: CommentSyntax = {
  blockEnd: "*/",
  blockStart: "/*",
  single: "//",
};

const HASH_COMMENT: CommentSyntax = {
  single: "#",
};

const PYTHON_COMMENT: CommentSyntax = {
  blockEnd: '"""',
  blockStart: '"""',
  single: "#",
};

const SQL_COMMENT: CommentSyntax = {
  blockEnd: "*/",
  blockStart: "/*",
  single: "--",
};

const HTML_COMMENT: CommentSyntax = {
  blockEnd: "-->",
  blockStart: "<!--",
};

const LUA_COMMENT: CommentSyntax = {
  blockEnd: "--]]",
  blockStart: "--[[",
  single: "--",
};

const SYNTAX_MAP: Record<string, CommentSyntax> = {
  // Hash-style comments
  bash: HASH_COMMENT,
  // C-like languages
  c: C_LIKE_COMMENT,
  cc: C_LIKE_COMMENT,
  conf: HASH_COMMENT,
  cpp: C_LIKE_COMMENT,
  cs: C_LIKE_COMMENT,
  css: { blockEnd: "*/", blockStart: "/*" },
  cxx: C_LIKE_COMMENT,
  dart: C_LIKE_COMMENT,
  dockerfile: HASH_COMMENT,
  env: HASH_COMMENT,
  go: C_LIKE_COMMENT,
  groovy: C_LIKE_COMMENT,
  h: C_LIKE_COMMENT,
  hpp: C_LIKE_COMMENT,

  // Markup
  htm: HTML_COMMENT,
  html: HTML_COMMENT,
  java: C_LIKE_COMMENT,
  js: C_LIKE_COMMENT,
  jsonc: C_LIKE_COMMENT,
  jsx: C_LIKE_COMMENT,
  kt: C_LIKE_COMMENT,
  kts: C_LIKE_COMMENT,
  less: C_LIKE_COMMENT,

  // SQL & Lua
  lua: LUA_COMMENT,
  mjs: C_LIKE_COMMENT,
  php: C_LIKE_COMMENT,
  pl: HASH_COMMENT,
  py: PYTHON_COMMENT,
  python: PYTHON_COMMENT,
  r: HASH_COMMENT,
  rb: HASH_COMMENT,
  rs: C_LIKE_COMMENT,
  scala: C_LIKE_COMMENT,
  scss: C_LIKE_COMMENT,
  sh: HASH_COMMENT,
  sql: SQL_COMMENT,
  svelte: HTML_COMMENT,
  svg: HTML_COMMENT,
  swift: C_LIKE_COMMENT,
  toml: HASH_COMMENT,
  ts: C_LIKE_COMMENT,
  tsx: C_LIKE_COMMENT,
  vue: HTML_COMMENT,
  xml: HTML_COMMENT,
  yaml: HASH_COMMENT,
  yml: HASH_COMMENT,
  zsh: HASH_COMMENT,
};

/**
 * TODO/FIXME markers inside a comment body.
 *
 * The boundaries are deliberately stricter than a bare word match: a leading
 * `-`/`_` is excluded so snake_case identifiers (`todo_list`) never count, and
 * a trailing `-` is excluded so URLs inside a string ("https://x/todo-list")
 * are not mistaken for a marker on a line whose only `#` or `//` came from the
 * scheme. `@` is accepted because `@todo` is a common convention.
 */
const TODO_MARKER_REGEX = /(?:^|[^\w-])@?(?:TODO|FIXME)(?![-\w])/giu;

/**
 * Cheap pre-check so the common case (no marker on the line) skips the
 * `matchAll` allocation. Must be case-insensitive to agree with the matcher
 * above, otherwise `// @todo` and `// Todo:` would be filtered out here and
 * never counted.
 */
const TODO_HINT_REGEX = /todo|fixme/i;

/** Number of TODO/FIXME markers in a single comment body. */
function countTodoMarkers(commentBody: string): number {
  if (!TODO_HINT_REGEX.test(commentBody)) {
    return 0;
  }

  // `matchAll` needs a global regex and never mutates the caller's lastIndex.
  return [...commentBody.matchAll(TODO_MARKER_REGEX)].length;
}

/**
 * Counts lines of code, comments, and TODO/FIXME markers without third-party
 * libraries.
 */
export function countSourceStats(content: string, rawExtension: string): CodeStats {
  if (typeof content !== "string" || content.length === 0) {
    return { comments: 0, empty: 0, source: 0, todos: 0, total: 0 };
  }

  const ext = rawExtension.toLowerCase().replace(/^\./u, "");
  const syntax = SYNTAX_MAP[ext] ?? { single: "//" };

  const lines = content.split(/\r?\n/u);
  const total = lines.length;

  let comments = 0;
  let source = 0;
  let empty = 0;
  let todos = 0;

  let inBlockComment = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (line.length === 0) {
      empty++;
      if (inBlockComment) {
        comments++;
      }
      continue;
    }

    if (inBlockComment) {
      comments++;

      if (syntax.blockEnd && line.includes(syntax.blockEnd)) {
        // Only the part before the closer is comment; the tail is code again.
        todos += countTodoMarkers(line.slice(0, line.indexOf(syntax.blockEnd)));

        const afterBlock = line
          .slice(line.indexOf(syntax.blockEnd) + syntax.blockEnd.length)
          .trim();
        if (afterBlock.length > 0) {
          source++;
        }
        inBlockComment = false;
      } else {
        todos += countTodoMarkers(line);
      }

      continue;
    }

    if (syntax.blockStart && line.includes(syntax.blockStart)) {
      const beforeBlock = line.slice(0, line.indexOf(syntax.blockStart)).trim();
      if (beforeBlock.length > 0) {
        source++;
      }

      comments++;

      if (syntax.blockEnd) {
        const afterStartIdx = line.indexOf(syntax.blockStart) + syntax.blockStart.length;
        const remainder = line.slice(afterStartIdx);

        if (remainder.includes(syntax.blockEnd)) {
          const endIdx = remainder.indexOf(syntax.blockEnd);
          todos += countTodoMarkers(remainder.slice(0, endIdx));

          const afterEnd = remainder.slice(endIdx + syntax.blockEnd.length).trim();
          if (afterEnd.length > 0) {
            source++;
          }
        } else {
          inBlockComment = true;
        }
      } else {
        inBlockComment = true;
      }
      continue;
    }

    if (syntax.single && line.startsWith(syntax.single)) {
      comments++;
      todos += countTodoMarkers(line.slice(syntax.single.length));
      continue;
    }

    if (syntax.single && line.includes(syntax.single)) {
      // Mixed line: code + trailing single-line comment. This is the branch
      // that leasot could never reach, because every one of its parsers anchors
      // the comment marker at the start of the line.
      source++;
      comments++;
      todos += countTodoMarkers(line.slice(line.indexOf(syntax.single) + syntax.single.length));
      continue;
    }

    source++;
  }

  return { comments, empty, source, todos, total };
}
