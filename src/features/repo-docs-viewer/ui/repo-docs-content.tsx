"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
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

import { buildRepoCodeHref } from "@/entities/repo/model/repo-workspace-navigation";
import type { DocContent } from "@/entities/repo/model/repo.types";

import { FloatingFileCard } from "./repo-floating-card";

type Props = {
  data?: DocContent;
  isLoading: boolean;
  repoId: string;
};

const isElement = (node: any): node is Element => {
  return (
    node != null &&
    typeof node === "object" &&
    "type" in node &&
    (node.type === "tag" || node.type === "script" || node.type === "style")
  );
};

const cleanTextNodes = (nodes: DOMNode[]): DOMNode[] => {
  return nodes.map((node) => {
    if ("data" in node && typeof node.data === "string") {
      return {
        ...node,
        data: node.data.replaceAll(/\s+/gu, " "),
      } as any;
    }
    return node;
  });
};

export function RepoDocsContent({ data, isLoading, repoId }: Readonly<Props>) {
  const [mounted, setMounted] = useState(false);
  const router = useRouter();

  const params = useParams();
  const owner = params.owner as string;
  const name = params.name as string;

  const [hoveredFile, setHoveredFile] = useState<null | string>(null);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  const handleHoverOrFocus = (e: React.SyntheticEvent) => {
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

  const handleHoverOrBlur = (e: React.SyntheticEvent) => {
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

      let result: React.JSX.Element | undefined;

      if (domNode.name === "blockquote") {
        const firstParagraph = domNode.children.find(
          (child: any): child is Element => isElement(child) && child.name === "p"
        );

        if (firstParagraph != null) {
          let match: null | RegExpExecArray = null;
          let firstTextNode: any = null;

          for (const child of firstParagraph.children) {
            if ("data" in child && typeof child.data === "string") {
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

            const configMap: Record<
              string,
              { className: string; icon: any; title: string; variant: "default" | "destructive" }
            > = {
              CAUTION: {
                className: "border-red-500/30 bg-red-500/5 text-red-500",
                icon: ShieldAlert,
                title: "Caution",
                variant: "destructive",
              },
              IMPORTANT: {
                className: "border-purple-500/30 bg-purple-500/5 text-purple-500",
                icon: Terminal,
                title: "Important",
                variant: "default",
              },
              NOTE: {
                className: "border-blue-500/30 bg-blue-500/5 text-blue-500",
                icon: Info,
                title: "Note",
                variant: "default",
              },
              TIP: {
                className: "border-emerald-500/30 bg-emerald-500/5 text-emerald-500",
                icon: Lightbulb,
                title: "Tip",
                variant: "default",
              },
              WARNING: {
                className: "border-amber-500/30 bg-amber-500/5 text-amber-500",
                icon: AlertTriangle,
                title: "Warning",
                variant: "default",
              },
            };

            const alertConfig = configMap[alertType] ?? configMap.NOTE;
            const IconComponent = alertConfig?.icon;

            const cleanedFirstTextNode = {
              ...firstTextNode,
              data: remainingText,
            };

            const firstTextNodeIndex = firstParagraph.children.indexOf(firstTextNode);
            const nextNodeIndex = firstTextNodeIndex + 1;

            const cleanedParagraphChildren = [
              ...firstParagraph.children.slice(0, firstTextNodeIndex),
              cleanedFirstTextNode,
              ...firstParagraph.children.slice(nextNodeIndex),
            ].filter((child: any): child is DOMNode => !(isElement(child) && child.name === "br"));

            const cleanedParagraphChildrenDOM = cleanTextNodes(cleanedParagraphChildren);

            const remainingContent = (
              <>
                {domToReact(cleanedParagraphChildrenDOM, parseOptions)}
                {domToReact(
                  domNode.children.filter((child: any) => child !== firstParagraph) as DOMNode[],
                  parseOptions
                )}
              </>
            );

            result = (
              <Alert
                variant={alertConfig?.variant}
                className={cn(
                  "not-prose my-6 rounded-xl border py-3.5 pl-11",
                  alertConfig?.className
                )}
              >
                <IconComponent className="absolute top-4 left-4 size-4" />
                <AlertTitle className="mb-1 font-sans text-xs font-bold tracking-wider uppercase">
                  {alertConfig?.title}
                </AlertTitle>

                <AlertDescription className="font-sans text-xs leading-relaxed opacity-90 [&_a]:inline [&_code]:inline">
                  {remainingContent}
                </AlertDescription>
              </Alert>
            );
          }
        }
      } else if (domNode.name === "a") {
        const href = domNode.attribs.href;
        if (href != null && !href.startsWith("http") && !href.startsWith("//")) {
          const children = domNode.children as DOMNode[];
          result = (
            <Link href={href} className={domNode.attribs.class}>
              {domToReact(children, parseOptions)}
            </Link>
          );
        }
      } else if (domNode.name === "pre") {
        const codeNode = domNode.children[0];

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

      <FloatingFileCard anchorEl={anchorEl} hoveredFile={hoveredFile} repoId={repoId} />
    </div>
  );
}
