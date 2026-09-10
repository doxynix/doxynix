export type CodeStats = {
  comments: number;
  empty: number;
  source: number;
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
  // Хэш-комментарии
  bash: HASH_COMMENT,
  // C-Like языки
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

  // Разметка
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
 * Подсчитывает строки кода и комментариев без сторонних библиотек.
 */
export function countSourceStats(content: string, rawExtension: string): CodeStats {
  if (typeof content !== "string" || content.length === 0) {
    return { comments: 0, empty: 0, source: 0, total: 0 };
  }

  const ext = rawExtension.toLowerCase().replace(/^\./u, "");
  const syntax = SYNTAX_MAP[ext] ?? { single: "//" };

  const lines = content.split(/\r?\n/u);
  const total = lines.length;

  let comments = 0;
  let source = 0;
  let empty = 0;

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
        const afterBlock = line
          .slice(line.indexOf(syntax.blockEnd) + syntax.blockEnd.length)
          .trim();
        if (afterBlock.length > 0) {
          source++;
        }
        inBlockComment = false;
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
          const afterEnd = remainder
            .slice(remainder.indexOf(syntax.blockEnd) + syntax.blockEnd.length)
            .trim();
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
      continue;
    }

    if (syntax.single && line.includes(syntax.single)) {
      // Смешанная строка: код + однострочный комментарий в конце
      source++;
      comments++;
      continue;
    }

    source++;
  }

  return { comments, empty, source, total };
}
