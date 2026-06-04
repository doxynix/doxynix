"use client";

import { useEffect, useState, type JSX, type SyntheticEvent } from "react";
import parse, {
  domToReact,
  type DOMNode,
  type Element,
  type HTMLReactParserOptions,
} from "html-react-parser";
import { AlertTriangle, Info, Lightbulb, ShieldAlert, Terminal } from "lucide-react";

import { Link, useRouter } from "@/shared/i18n/routing";
import { cn } from "@/shared/lib/cn";
import { Alert, AlertDescription, AlertTitle } from "@/shared/ui/core/alert";
import { AppMermaid } from "@/shared/ui/core/mermaid";
import { Skeleton } from "@/shared/ui/core/skeleton";
import { CopyButton } from "@/shared/ui/kit/copy-button";
import { ExternalLink } from "@/shared/ui/kit/external-link";

import { buildRepoCodeHref } from "@/entities/repo/model/repo-workspace-navigation";
import type { DocContent } from "@/entities/repo/model/repo.types";
import { useRepoParams } from "@/entities/repo/model/use-repo-params";

import { RepoFloatingCard } from "./repo-floating-card";

type Props = {
  data?: DocContent;
  isLoading: boolean;
  repoId: string;
};

const isElement = (node: DOMNode): node is Element => {
  return "type" in node && (node.type === "tag" || node.type === "script" || node.type === "style");
};

const isTextNode = (node: DOMNode): node is DOMNode & { data: string } => {
  return "data" in node && typeof (node as any).data === "string";
};

const cleanTextNodes = (nodes: DOMNode[]): DOMNode[] => {
  return nodes.map((node) => {
    if (isTextNode(node)) {
      const textObj = node as unknown as { data: string };
      return {
        ...textObj,
        data: textObj.data.replaceAll(/\s+/gu, " "),
      } as unknown as DOMNode;
    }
    return node;
  });
};

export function RepoDocsContent({ data, isLoading, repoId }: Readonly<Props>) {
  const [mounted, setMounted] = useState(false);
  const router = useRouter();

  const { name, owner } = useRepoParams();

  const [hoveredFile, setHoveredFile] = useState<null | string>(null);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  const handleHoverOrFocus = (e: SyntheticEvent) => {
    const target = e.target as HTMLElement;
    const wikiLink = target.closest("a") as HTMLAnchorElement | null;

    if (
      wikiLink &&
      (wikiLink.classList.contains("doxynix-wiki-link") || wikiLink.href.includes("node="))
    ) {
      const href = wikiLink.getAttribute("href");
      if (href != null) {
        const urlParams = new URLSearchParams(href.split("?")[1]);
        const rawPath =
          urlParams.get("path") ??
          urlParams.get("node")?.replace("file:", "").replace("group:", "");

        if (rawPath != null) {
          const decodedPath = decodeURIComponent(rawPath);
          setHoveredFile(decodedPath);
          setAnchorEl(wikiLink);
        }
      }
    }
  };

  const handleHoverOrBlur = (e: SyntheticEvent) => {
    const target = e.target as HTMLElement;
    const relatedTarget = (e as any).relatedTarget as HTMLElement | null;

    const currentLink = target.closest("a");
    const nextLink = relatedTarget?.closest("a");

    if (currentLink === nextLink) {
      return;
    }

    setHoveredFile(null);
    setAnchorEl(null);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-100 w-full" />
      </div>
    );
  }

  if (data == null) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>Failed to load documentation content.</AlertDescription>
      </Alert>
    );
  }

  const parseOptions: HTMLReactParserOptions = {
    replace: (domNode: DOMNode) => {
      if (!isElement(domNode)) {
        return;
      }

      let result: JSX.Element | undefined;

      if (domNode.name === "blockquote") {
        const firstParagraph = (domNode.children as DOMNode[]).find(
          (child): child is Element => isElement(child) && child.name === "p"
        );

        if (firstParagraph != null) {
          let match: null | RegExpExecArray = null;
          let firstTextNode: (DOMNode & { data: string }) | null = null;

          for (const child of firstParagraph.children as DOMNode[]) {
            if (isTextNode(child)) {
              const textContent = child.data.trim();

              const m = /^["'‘“]?\[!(note|warning|tip|important|caution)]["'’”]?/i.exec(
                textContent
              );

              if (m != null) {
                match = m;
                firstTextNode = child;
                break;
              }
            }
          }

          if (match != null && firstTextNode != null) {
            const alertType = (match[1] ?? "NOTE").toUpperCase();
            const remainingText = String(firstTextNode.data).trim().slice(match[0].length).trim();

            const configMap = {
              CAUTION: {
                className: "border-red-500/30 bg-red-500/5 text-red-500",
                icon: ShieldAlert,
                title: "Caution",
                variant: "destructive" as const,
              },
              IMPORTANT: {
                className: "border-purple-500/30 bg-purple-500/5 text-purple-500",
                icon: Terminal,
                title: "Important",
                variant: "default" as const,
              },
              NOTE: {
                className: "border-blue-500/30 bg-blue-500/5 text-blue-500",
                icon: Info,
                title: "Note",
                variant: "default" as const,
              },
              TIP: {
                className: "border-emerald-500/30 bg-emerald-500/5 text-emerald-500",
                icon: Lightbulb,
                title: "Tip",
                variant: "default" as const,
              },
              WARNING: {
                className: "border-amber-500/30 bg-amber-500/5 text-amber-500",
                icon: AlertTriangle,
                title: "Warning",
                variant: "default" as const,
              },
            } as const;

            const alertConfig =
              alertType in configMap
                ? configMap[alertType as keyof typeof configMap]
                : configMap.NOTE;

            const IconComponent = alertConfig.icon;

            const textObj = firstTextNode as unknown as { data: string };
            const cleanedFirstTextNode = {
              ...textObj,
              data: remainingText,
            } as unknown as DOMNode;

            const firstTextNodeIndex = (firstParagraph.children as DOMNode[]).indexOf(
              firstTextNode
            );
            const nextNodeIndex = firstTextNodeIndex + 1;

            const cleanedParagraphChildren = [
              ...(firstParagraph.children as DOMNode[]).slice(0, firstTextNodeIndex),
              cleanedFirstTextNode,
              ...(firstParagraph.children as DOMNode[]).slice(nextNodeIndex),
            ].filter((child): child is DOMNode => !(isElement(child) && child.name === "br"));

            const cleanedParagraphChildrenDOM = cleanTextNodes(cleanedParagraphChildren);

            const remainingContent = (
              <div className="flex flex-col gap-2">
                <p>{domToReact(cleanedParagraphChildrenDOM, parseOptions)}</p>

                {domToReact(
                  (domNode.children as DOMNode[]).filter((child) => child !== firstParagraph),
                  parseOptions
                )}
              </div>
            );

            result = (
              <Alert
                variant={alertConfig.variant}
                className={cn(
                  "not-prose my-6 rounded-xl border py-3.5 pl-11",
                  alertConfig.className
                )}
              >
                <IconComponent className="absolute top-4 left-4" />
                <AlertTitle className="mb-1 font-sans text-xs font-bold uppercase">
                  {alertConfig.title}
                </AlertTitle>

                <AlertDescription className="text-muted-foreground font-sans text-xs [&_a]:inline [&_code]:inline">
                  {remainingContent}
                </AlertDescription>
              </Alert>
            );
          }
        }
      } else if (domNode.name === "a") {
        const href = domNode.attribs.href;

        if (href != null) {
          const isInternal = href.startsWith("/") || href.startsWith("?") || href.startsWith("#");
          const children = domNode.children as DOMNode[];

          if (isInternal) {
            result = (
              <Link href={href} className={domNode.attribs.class}>
                {domToReact(children, parseOptions)}
              </Link>
            );
          } else {
            const lowerHref = href.toLowerCase().trim();
            const isUnsafe =
              lowerHref.startsWith("javascript:") ||
              lowerHref.startsWith("data:") ||
              lowerHref.startsWith("vbscript:");

            if (!isUnsafe) {
              const safeAttribs = { ...domNode.attribs };

              delete safeAttribs.href;
              delete safeAttribs.target;
              delete safeAttribs.rel;

              if (lowerHref.startsWith("http")) {
                result = (
                  <ExternalLink href={href} {...safeAttribs}>
                    {domToReact(children, parseOptions)}
                  </ExternalLink>
                );
              } else {
                result = (
                  <a href={href} {...safeAttribs}>
                    {domToReact(children, parseOptions)}
                  </a>
                );
              }
            } else {
              result = (
                <span className="text-destructive border-destructive/20 bg-destructive/5 rounded border px-1.5 py-0.5 font-mono text-[10px] select-none">
                  [Blocked Unsafe Link]
                </span>
              );
            }
          }
        }
      } else if (domNode.name === "pre") {
        const codeNode = (domNode.children as DOMNode[])[0];

        if (codeNode && isElement(codeNode) && codeNode.name === "code") {
          const className = codeNode.attribs.class ?? "";

          if (className.includes("language-mermaid")) {
            const chartText = domNode.attribs["data-raw"] ?? "";
            result = (
              <div className="my-6 flex justify-center">
                <AppMermaid
                  buildHref={(filePath) => {
                    return buildRepoCodeHref({
                      name,
                      nodeId: `file:${filePath}`,
                      owner,
                    });
                  }}
                  chart={chartText}
                  onLinkClick={(href, e) => {
                    e.preventDefault();
                    router.push(href);
                  }}
                  className="bg-muted/20 max-w-full rounded-xl border p-4"
                />
              </div>
            );
          } else {
            const rawCode = domNode.attribs["data-raw"] ?? "";
            const children = domNode.children as DOMNode[];

            const safeAttribs = { ...domNode.attribs };
            delete safeAttribs.style;

            result = (
              <div className="group relative">
                <div className="absolute top-3 right-3 z-10 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                  <CopyButton
                    value={rawCode}
                    tooltipText="Copy code"
                    className="bg-background/80 hover:bg-background shadow-md"
                  />
                </div>
                <pre {...safeAttribs}>{domToReact(children, parseOptions)}</pre>
              </div>
            );
          }
        }
      }

      return result;
    },
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
      <article
        onBlur={handleHoverOrBlur}
        onFocus={handleHoverOrFocus}
        onMouseOut={handleHoverOrBlur}
        onMouseOver={handleHoverOrFocus}
        className="prose dark:prose-invert prose-pre:p-0 prose-pre:bg-transparent max-w-none min-w-0 wrap-break-word"
      >
        {mounted ? (
          parse(data.html, parseOptions)
        ) : (
          <div dangerouslySetInnerHTML={{ __html: data.html }} />
        )}
      </article>

      <RepoFloatingCard anchorEl={anchorEl} hoveredFile={hoveredFile} repoId={repoId} />
    </div>
  );
}
