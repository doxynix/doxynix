import { getHighlighter } from "@/shared/lib/shiki";

export async function markdownToHtml(content: string) {
  if (content === "") return "";
  const highlight = await getHighlighter();

  const result = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkEmoji)
    .use(remarkBreaks)
    .use(remarkMath)
    .use(remarkToc, { heading: "содержание|table of contents|оглавление", tight: true })

    .use(remarkRehype, { allowDangerousHtml: true })

    .use(rehypeSanitize, {
      ...defaultSchema,
      attributes: {
        ...defaultSchema.attributes,
        "*": ["className", "style", "id", "ariaHidden"],
      },
      clobberPrefix: "",
      tagNames: [
        ...(defaultSchema.tagNames ?? []),
        "span",
        "div",
        "code",
        "pre",
        "math",
        "mi",
        "mn",
        "mo",
        "ms",
        "mspace",
        "mtext",
      ],
    })

    .use(rehypeKatex)
    .use(rehypeSlug)
    .use(rehypeAutolinkHeadings, {
      behavior: "append",
      content: {
        children: [{ type: "text", value: "#" }],
        properties: { className: ["hover-link", "ml-2", "opacity-30", "text-sm", "select-none"] },
        tagName: "span",
        type: "element",
      },
    })
    .use(rehypeExternalLinks, {
      rel: ["nofollow", "noopener", "noreferrer"],
      target: "_blank",
    })

    .use(rehypeShiki, {
      highlighter: highlight,
      themes: { dark: "github-dark-dimmed", light: "github-light" },
    })

    .use(rehypeStringify)
    .process(content);

  return String(result.value);
}
