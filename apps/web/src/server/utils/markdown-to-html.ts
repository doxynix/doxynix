import rehypeShiki from "@shikijs/rehype";
import {
  transformerNotationDiff,
  transformerNotationFocus,
  transformerNotationHighlight,
} from "@shikijs/transformers";
import type { Element as HastElement, Root } from "hast";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypeExternalLinks from "rehype-external-links";
import rehypeKatex from "rehype-katex";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import rehypeSlug from "rehype-slug";
import rehypeStringify from "rehype-stringify";
import remarkBreaks from "remark-breaks";
import remarkEmoji from "remark-emoji";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import remarkToc from "remark-toc";
import remarkWikiLink from "remark-wiki-link";
import { unified } from "unified";
import { visit } from "unist-util-visit";

const trackRawCode = (node: HastElement) => {
  if (node.tagName === "pre") {
    const codeNode = node.children[0] as HastElement | undefined;

    if (codeNode != null && codeNode.tagName === "code") {
      const textNode = codeNode.children[0];
      let rawCode = "";

      if (textNode != null && "value" in textNode) {
        rawCode = String(textNode.value);
      }

      node.properties["data-raw"] = rawCode;
    }
  }
};

const ignoreMermaid = (node: HastElement) => {
  if (node.tagName === "pre") {
    const codeNode = node.children[0] as HastElement | undefined;

    if (codeNode != null && codeNode.tagName === "code") {
      const className = codeNode.properties.className;

      const classes = Array.isArray(className)
        ? className.map(String)
        : className != null
          ? [String(className)]
          : [];

      if (classes.some((cls) => cls === "language-mermaid" || cls.startsWith("language-mermaid"))) {
        codeNode.properties.className = ["language-mermaid-raw"];
      }
    }
  }
};

const rawCodeTrackerTransformer = (tree: Root) => {
  visit(tree, "element", trackRawCode);
};

const ignoreMermaidTransformer = (tree: Root) => {
  visit(tree, "element", ignoreMermaid);
};

function rehypeRawCodeTracker() {
  return rawCodeTrackerTransformer;
}

function rehypeIgnoreMermaid() {
  return ignoreMermaidTransformer;
}

type MarkdownToHtmlOptions = {
  content: string;
  name?: string;
  owner?: string;
};

export async function markdownToHtml({
  content,
  name,
  owner,
}: MarkdownToHtmlOptions): Promise<string> {
  if (content === "") return "";

  const result = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkWikiLink, {
      aliasDivider: "|",
      hrefTemplate: (permalink: string) => {
        const encodedPath = encodeURIComponent(permalink);
        if (owner != null && name != null) {
          return `/dashboard/repo/${owner}/${name}/code?node=group:${encodedPath}&path=${encodedPath}`;
        }
        return `code?node=group:${encodedPath}&path=${encodedPath}`;
      },
      pageResolver: (name: string) => [name.trim()],
      wikiLinkClassName: "doxynix-wiki-link",
    })
    .use(remarkEmoji)
    .use(remarkBreaks)
    .use(remarkMath)
    .use(remarkToc, {
      heading: "содержание|table of contents|оглавление",
      tight: true,
    })
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeRaw)
    .use(rehypeRawCodeTracker)
    .use(rehypeIgnoreMermaid)
    .use(rehypeSanitize, {
      ...defaultSchema,
      attributes: {
        ...defaultSchema.attributes,
        "*": ["className", "style", "id", "ariaHidden", "data-raw"],
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
        properties: {
          className: ["hover-link", "ml-2", "opacity-30", "text-sm", "select-none"],
        },
        tagName: "span",
        type: "element",
      },
    })
    .use(rehypeExternalLinks, {
      rel: ["nofollow", "noopener", "noreferrer"],
      target: "_blank",
    })
    .use(rehypeShiki, {
      themes: { dark: "github-dark-dimmed", light: "github-light" },
      transformers: [
        transformerNotationHighlight(),
        transformerNotationDiff(),
        transformerNotationFocus(),
      ],
    })
    .use(rehypeStringify)
    .process(content);

  return String(result.value);
}
