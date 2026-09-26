"use client";

import { Children, createContext, isValidElement, type ReactNode, useContext } from "react";
import { AlertTriangle, Info, Lightbulb, ShieldAlert, Terminal } from "lucide-react";
import { motion } from "motion/react";
import { useTranslations } from "next-intl";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { remarkAlert } from "remark-github-blockquote-alert";
import type { PluggableList } from "unified";

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

const StreamContext = createContext(false);

const revealTransition = { duration: 0.18, ease: "easeOut" } as const;

function useReveal() {
  const isStreaming = useContext(StreamContext);

  return {
    animate: { opacity: 1, y: 0 },
    initial: isStreaming ? { opacity: 0, y: 4 } : false,
    transition: revealTransition,
  };
}

type HeadingTag = "h1" | "h2" | "h3" | "h4" | "h5" | "h6";

function heading(tag: HeadingTag) {
  const Tag = motion[tag];

  function Heading({ children }: BlockProps) {
    return (
      <Tag
        className="mt-4 mb-1.5 font-semibold first:mt-0"
        {...useReveal()}
      >
        {children}
      </Tag>
    );
  }

  Heading.displayName = `Markdown${tag.toUpperCase()}`;

  return Heading;
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

type BlockProps = { children?: ReactNode; className?: string };

function Blockquote({ children, className }: BlockProps) {
  const t = useTranslations("Dashboard");
  const reveal = useReveal();
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
    <motion.blockquote
      className="my-2 border-border border-l-2 pl-4 text-left text-muted-foreground italic"
      {...reveal}
    >
      {children}
    </motion.blockquote>
  );
}

function Code({ children, className, ...props }: BlockProps) {
  const isStreaming = useContext(StreamContext);
  const isInline = !(className?.includes("language-") ?? false) && !String(children).includes("\n");
  const lang = /language-([\w-]+)/.exec(className ?? "")?.[1] ?? "text";

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
      code={String(children).replace(/\n$/, "")}
      isStreaming={isStreaming}
      lang={lang}
    />
  );
}

function ListItem({ children }: BlockProps) {
  return (
    <motion.li
      className="mt-0 mb-0"
      {...useReveal()}
    >
      {children}
    </motion.li>
  );
}

function Paragraph({ children }: BlockProps) {
  return (
    <motion.p
      className="mb-1 leading-relaxed last:mb-0"
      {...useReveal()}
    >
      {children}
    </motion.p>
  );
}

function Pre({ children }: BlockProps) {
  return <>{children}</>;
}

function UnorderedList({ children }: BlockProps) {
  return <ul className="mb-1 flex list-disc flex-col gap-0.5 pl-4">{children}</ul>;
}

const components = {
  blockquote: Blockquote,
  code: Code,
  h1: heading("h1"),
  h2: heading("h2"),
  h3: heading("h3"),
  h4: heading("h4"),
  h5: heading("h5"),
  h6: heading("h6"),
  li: ListItem,
  p: Paragraph,
  pre: Pre,
  ul: UnorderedList,
};

const remarkPlugins: PluggableList = [remarkGfm, [remarkAlert, { tagName: "blockquote" }]];

const MarkdownBlock = ({ content, isStreaming }: { content: string; isStreaming: boolean }) => (
  <StreamContext.Provider value={isStreaming}>
    <ReactMarkdown
      components={components}
      remarkPlugins={remarkPlugins}
    >
      {content}
    </ReactMarkdown>
  </StreamContext.Provider>
);

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
