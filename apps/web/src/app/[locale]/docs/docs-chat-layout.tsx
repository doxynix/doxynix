"use client";

import type { ReactNode } from "react";
import { useChat } from "@ai-sdk/react";
import {
  type AIChatOptions,
  AIChatPanel,
  AIChatProvider,
  AIChatSearch,
  AIChatTrigger,
  useAIChat,
} from "@fumadocs/ai-chat";
import { DefaultChatTransport } from "ai";
import { DocsLayout, type DocsLayoutProps } from "fumadocs-ui/layouts/docs";
import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";

type Props = {
  baseOptions: BaseLayoutProps;
  children: ReactNode;
  tree: DocsLayoutProps["tree"];
};

type SearchPart = Parameters<typeof AIChatSearch>[0]["part"];

const SUGGESTIONS = [
  "How do I run my first analysis?",
  "What can the CLI do?",
  "How do I export documentation?",
  "What is the health score?",
];

const transport = new DefaultChatTransport({ api: "/api/docs-chat" });

const renderPart: NonNullable<AIChatOptions["renderPart"]> = (part, live) => {
  if (part.type !== "tool-search") {
    return null;
  }

  return (
    <AIChatSearch
      live={live}
      part={part as SearchPart}
    />
  );
};

export function DocsChatLayout({ baseOptions, children, tree }: Props) {
  const chat = useChat({ throttle: 32, transport });

  return (
    <AIChatProvider
      chat={chat}
      description="Answers come from the Doxynix documentation."
      renderPart={renderPart}
      suggestions={SUGGESTIONS}
    >
      <ChatLayout
        baseOptions={baseOptions}
        tree={tree}
      >
        {children}
      </ChatLayout>
      <AIChatTrigger />
    </AIChatProvider>
  );
}

function ChatLayout({ baseOptions, children, tree }: Props) {
  const { open, setOpen } = useAIChat();

  return (
    <DocsLayout
      {...baseOptions}
      aiChat={{ onOpenChange: setOpen, open, panel: <AIChatPanel /> }}
      tree={tree}
    >
      {children}
    </DocsLayout>
  );
}
