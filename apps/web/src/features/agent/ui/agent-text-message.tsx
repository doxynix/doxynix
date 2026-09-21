"use client";

import { Children, isValidElement, type ReactNode } from "react";
import { AlertTriangle, Info, Lightbulb, ShieldAlert, Terminal } from "lucide-react";
import { useTranslations } from "next-intl";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { remarkAlert } from "remark-github-blockquote-alert";

import { cn } from "@/shared/lib/cn";
import { Alert, AlertDescription, AlertTitle } from "@/shared/ui/core/alert";

import { ChatCodeBlock } from "./chat-code-block";

type Props = {
  content: string;
  id: string;
  isStreaming: boolean;
};

const configMap = {
  CAUTION: {
    className: "border-red-500/30 bg-red-500/5 text-red-500",
    icon: ShieldAlert,
    titleKey: "alert_caution",
    variant: "destructive" as const,
  },
  IMPORTANT: {
    className: "border-purple-500/30 bg-purple-500/5 text-purple-500",
    icon: Terminal,
    titleKey: "alert_important",
    variant: "default" as const,
  },
  NOTE: {
    className: "border-blue-500/30 bg-blue-500/5 text-blue-500",
    icon: Info,
    titleKey: "alert_note",
    variant: "default" as const,
  },
  TIP: {
    className: "border-success/30 bg-success/5 text-emerald-500",
    icon: Lightbulb,
    titleKey: "alert_tip",
    variant: "default" as const,
  },
  WARNING: {
    className: "border-amber-500/30 bg-amber-500/5 text-amber-500",
    icon: AlertTriangle,
    titleKey: "alert_warning",
    variant: "default" as const,
  },
} as const;

type AlertType = keyof typeof configMap;

function isMarkdownAlert(className: string | undefined): AlertType | null {
  const match = /markdown-alert-(note|tip|important|warning|caution)/i.exec(className ?? "");

  if (match == null) {
    return null;
  }

  const type = match[1];

  if (type == null) {
    return null;
  }

  return type.toUpperCase() as AlertType;
}

function stripPluginTitle(children: ReactNode): ReactNode {
  return Children.toArray(children).filter((child) => {
    if (!isValidElement(child)) {
      return true;
    }

    const childClass = (child.props as { className?: string }).className;
    return !String(childClass).includes("markdown-alert-title");
  });
}

const MarkdownBlock = ({ content, isStreaming }: { content: string; isStreaming: boolean }) => {
  const t = useTranslations("Dashboard");

  return (
    <ReactMarkdown
      components={{
        blockquote({ children, className }) {
          const alertType = isMarkdownAlert(className);

          if (alertType != null) {
            const alertConfig = configMap[alertType];
            const IconComponent = alertConfig.icon;

            return (
              <Alert
                className={cn(
                  "not-prose my-4 rounded-xl border py-3.5 pl-11 text-left",
                  alertConfig.className,
                )}
                variant={alertConfig.variant}
              >
                <IconComponent className="absolute top-4 left-4 size-4" />
                <AlertTitle className="mb-1 font-bold font-sans text-xs uppercase tracking-wider">
                  {t(alertConfig.titleKey)}
                </AlertTitle>
                <AlertDescription className="font-sans text-xs leading-relaxed opacity-90">
                  {stripPluginTitle(children)}
                </AlertDescription>
              </Alert>
            );
          }

          return (
            <blockquote className="my-2 border-border border-l-2 pl-4 text-left text-muted-foreground italic">
              {children}
            </blockquote>
          );
        },

        code({ children, className, ...props }) {
          const codeText = String(children).replace(/\n$/, "");

          const isInline =
            !(className?.includes("language-") ?? false) && !String(children).includes("\n");
          const match = /language-([\w-]+)/.exec(className ?? "");
          const lang = match?.[1] ?? "text";

          if (isInline) {
            return (
              <code
                className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-card-foreground text-xs"
                {...props}
              >
                {children}
              </code>
            );
          }

          return (
            <ChatCodeBlock
              code={codeText}
              isStreaming={isStreaming}
              lang={lang}
            />
          );
        },

        li: ({ children }) => <li className="mt-0 mb-0">{children}</li>,

        p: ({ children }) => <p className="mb-1 leading-relaxed last:mb-0">{children}</p>,

        pre: ({ children }) => <>{children}</>,

        ul: ({ children }) => (
          <ul className="mb-1 flex list-disc flex-col gap-0.5 pl-4">{children}</ul>
        ),
      }}
      remarkPlugins={[remarkGfm, [remarkAlert, { tagName: "blockquote" }]]}
    >
      {content}
    </ReactMarkdown>
  );
};

MarkdownBlock.displayName = "MarkdownBlock";

export default function AgentTextMessage({ content, id, isStreaming }: Readonly<Props>) {
  return (
    <div
      className="prose prose-sm dark:prose-invert w-full max-w-none text-left transition-standard"
      data-message-id={id}
    >
      <MarkdownBlock
        content={content}
        isStreaming={isStreaming}
      />
    </div>
  );
}
