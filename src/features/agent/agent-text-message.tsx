"use client";

import {
  Children,
  cloneElement,
  isValidElement,
  memo,
  type ReactElement,
  type ReactNode,
} from "react";
import { AlertTriangle, Info, Lightbulb, ShieldAlert, Terminal } from "lucide-react";
import { marked } from "marked";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { cn } from "@/shared/lib/cn";
import { Alert, AlertDescription, AlertTitle } from "@/shared/ui/core/alert";

import { RepoCodeEditor } from "@/features/repo-code-viewer/ui/repo-code-editor";

type Props = {
  content: string;
  id: string;
  isStreaming: boolean;
};

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
    className: "border-success/30 bg-success/5 text-emerald-500",
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

function getTextFromChildren(children: ReactNode): string {
  let text = "";
  Children.forEach(children, (child) => {
    if (typeof child === "string" || typeof child === "number") {
      text += String(child);
    } else if (isValidElement(child)) {
      const element = child as ReactElement<{ children?: ReactNode }>;
      if ("children" in element.props && element.props.children !== undefined) {
        text += getTextFromChildren(element.props.children);
      }
    }
  });
  return text;
}

function stripAlertFromChildren(children: ReactNode, state: { charsToStrip: number }): ReactNode {
  return Children.map(children, (child) => {
    if (state.charsToStrip <= 0) {
      return child;
    }

    if (typeof child === "string" || typeof child === "number") {
      const childStr = String(child);
      const stripLength = Math.min(childStr.length, state.charsToStrip);
      const cleaned = childStr.slice(stripLength);
      state.charsToStrip -= stripLength;

      if (cleaned.endsWith('"') && state.charsToStrip === 0) {
        return cleaned.slice(0, -1);
      }
      return cleaned === "" ? null : cleaned;
    }

    if (isValidElement(child)) {
      const element = child as ReactElement<{ children?: ReactNode }>;
      if ("children" in element.props && element.props.children !== undefined) {
        const cleanedChildren = stripAlertFromChildren(element.props.children, state);
        return cloneElement(element, {}, cleanedChildren);
      }
    }

    return child;
  });
}

function renderAlertOrFallback(
  children: ReactNode,
  fallback: (cleanedContent: ReactNode) => ReactNode
): ReactNode {
  const fullText = getTextFromChildren(children);

  const regex = /^[ "'‘“]*\[!(note|warning|tip|important|caution)][ "'’”]*\s*/i;
  const match = regex.exec(fullText);
  const rawType = match?.[1];

  if (match != null && rawType != null) {
    const alertType = rawType.toUpperCase() as keyof typeof configMap;
    const alertConfig = configMap[alertType];
    const IconComponent = alertConfig.icon;
    const matchedLength = match[0].length;

    const stripState = { charsToStrip: matchedLength };
    const remainingContent = stripAlertFromChildren(children, stripState);

    return (
      <Alert
        variant={alertConfig.variant}
        className={cn(
          "not-prose my-4 rounded-xl border py-3.5 pl-11 text-left",
          alertConfig.className
        )}
      >
        <IconComponent className="absolute top-4 left-4 size-4" />
        <AlertTitle className="mb-1 font-sans text-xs font-bold tracking-wider uppercase">
          {alertConfig.title}
        </AlertTitle>
        <AlertDescription className="font-sans text-xs leading-relaxed opacity-90">
          {remainingContent}
        </AlertDescription>
      </Alert>
    );
  }

  return fallback(children);
}

const MarkdownBlock = memo(
  ({ content }: { content: string }) => {
    return (
      <ReactMarkdown
        components={{
          blockquote({ children }) {
            return renderAlertOrFallback(children, (cleaned) => (
              <blockquote className="border-border/60 text-muted-foreground my-2 border-l-2 pl-4 text-left italic">
                {cleaned}
              </blockquote>
            ));
          },

          code({ children, className, ...props }) {
            const codeText = String(children).replace(/\n$/, "");

            const isInline =
              !(className?.includes("language-") ?? false) && !String(children).includes("\n");
            const match = /language-(\w+)/.exec(className ?? "");
            const lang = match ? match[1] : "txt";

            if (isInline) {
              return (
                <code
                  className="bg-muted text-card-foreground border-border/40 rounded border px-1.5 py-0.5 font-mono text-xs"
                  {...props}
                >
                  {children}
                </code>
              );
            }
            return (
              <div className="border-border/60 bg-background my-3 h-70 w-full overflow-hidden rounded-xl border text-xs shadow-sm">
                <RepoCodeEditor
                  value={codeText}
                  meta={{ name: `file.${lang}`, sha: "dummy", size: 0, url: "https://dummy.com" }}
                  minimal={true}
                  path={`file.${lang}`}
                  readOnly={true}
                />
              </div>
            );
          },

          li: ({ children }) => <li className="mt-0 mb-0">{children}</li>,

          p({ children }) {
            return renderAlertOrFallback(children, (cleaned) => (
              <p className="mb-1 leading-relaxed last:mb-0">{cleaned}</p>
            ));
          },
          pre: ({ children }) => <>{children}</>,
          ul: ({ children }) => (
            <ul className="mb-1 flex list-disc flex-col gap-0.5 pl-4">{children}</ul>
          ),
        }}
        remarkPlugins={[remarkGfm]}
      >
        {content}
      </ReactMarkdown>
    );
  },
  (prevProps, nextProps) => prevProps.content === nextProps.content
);

MarkdownBlock.displayName = "MarkdownBlock";

export default function AgentTextMessage({ content, id }: Readonly<Props>) {
  const tokens = marked.lexer(content);
  const blocks = tokens.map((token) => token.raw);

  return (
    <div className="prose prose-sm dark:prose-invert w-full max-w-none text-left transition-all">
      {blocks.map((block, index) => (
        <MarkdownBlock key={`${id}-block_${index}`} content={block} />
      ))}
    </div>
  );
}
