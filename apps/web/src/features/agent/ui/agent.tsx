"use client";
import { type ChangeEvent, type SyntheticEvent, useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { ChatStatus, UIMessage } from "ai";
import { DefaultChatTransport, lastAssistantMessageIsCompleteWithApprovalResponses } from "ai";
import { ArrowDown } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useTranslations } from "next-intl";
import { type Components, Virtuoso, type VirtuosoHandle } from "react-virtuoso";

import { useTRPC } from "@/shared/api/trpc";
import { EASING } from "@/shared/config/motion";
import { cn } from "@/shared/lib/cn";
import { useAppearancePreferences } from "@/shared/lib/hooks/use-appearance-preferences";
import { usePanelLayout } from "@/shared/lib/hooks/use-panel-layout";
import { DxnxLogo } from "@/shared/ui/branding/dxnx-logo";
import { AppButton } from "@/shared/ui/core/button";
import { Card } from "@/shared/ui/core/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/shared/ui/core/empty";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/shared/ui/core/resizable";
import { useSidebar } from "@/shared/ui/core/sidebar";
import { ActionErrorAlert } from "@/shared/ui/kit/action-error-alert";
import { AnimatedShinyText } from "@/shared/ui/visuals/animated-shiny-text";

import { useRepoParams } from "@/entities/repo/model/use-repo-params";

import { TOOL_INVALIDATIONS, toolLabelKeys } from "../model/agent-config";
import type { AgentMessagePart, LocalFileAttachment } from "../model/agent-types";
import { useAgentIsOpen } from "../model/use-agent.store";
import { AgentForm } from "./agent-form";
import { AgentHeader } from "./agent-header";
import { AgentMessageRow } from "./agent-message";
import { AgentSidebar } from "./agent-sidebar";
import { AgentSuggestions } from "./agent-suggestions";

function buildMessageParts(text: string, files: LocalFileAttachment[]): AgentMessagePart[] {
  const parts: AgentMessagePart[] = [];

  if (text.trim() !== "") {
    parts.push({ text, type: "text" });
  }

  for (const file of files) {
    parts.push({
      filename: file.name,
      mediaType: file.contentType,
      type: "file",
      url: file.url,
    });
  }

  return parts;
}

function AgentListFooter({ context }: Readonly<{ context?: ChatStatus }>) {
  const t = useTranslations("Agent");

  if (context !== "submitted") {
    return null;
  }

  return (
    <div className="px-4 pb-2">
      <AnimatedShinyText className="mx-0 self-start text-xs">{t("thinking")}</AnimatedShinyText>
    </div>
  );
}

// Hoisted so Virtuoso never remounts its footer when the panel re-renders.
const AGENT_LIST_COMPONENTS: Components<UIMessage, ChatStatus> = {
  Footer: AgentListFooter,
};

const INCREASE_VIEWPORT_BY = { bottom: 400, top: 200 };

const INITIAL_TOP_MOST_ITEM_INDEX = { align: "end", index: "LAST" } as const;

function computeMessageKey(_: number, message: UIMessage) {
  return message.id;
}

export function Agent() {
  const trpc = useTRPC();
  const t = useTranslations("Agent");
  const isOpen = useAgentIsOpen();

  const { defaultLayout, onLayoutChanged } = usePanelLayout("agent");

  const [expanded, setExpanded] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<null | string>(null);
  const [editInput, setEditInput] = useState("");
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<LocalFileAttachment[]>([]);
  const [isAtBottom, setIsAtBottom] = useState(true);

  const virtuosoRef = useRef<VirtuosoHandle>(null);

  const { name, owner } = useRepoParams();
  const currentRepo = owner && name ? { name, owner } : undefined;

  const [sessionId, setSessionId] = useState<null | string>(() => crypto.randomUUID());

  const lastLoadedSessionIdRef = useRef<null | string>(sessionId);

  const queryClient = useQueryClient();
  // Guards against two submits in the same tick, where `status` from the last render is stale.
  const submittingRef = useRef(false);

  const { data: sessions } = useQuery(
    trpc.agent.listSessions.queryOptions({ currentRepo }, { enabled: isOpen }),
  );

  const isSessionSaved = sessions?.some((s) => s.id === sessionId);

  const { data: history, isLoading: isHistoryLoading } = useQuery(
    trpc.agent.getSessionHistory.queryOptions(
      { sessionId: sessionId ?? "" },
      { enabled: sessionId !== null && isOpen },
    ),
  );

  const {
    addToolApprovalResponse,
    clearError,
    error,
    messages,
    regenerate,
    sendMessage,
    setMessages,
    status,
    stop,
  } = useChat({
    id: sessionId ?? undefined,
    messages:
      history?.map((msg) => ({
        createdAt: msg.createdAt,
        id: msg.id,
        parts: msg.parts,
        role: msg.role as "assistant" | "system" | "user",
      })) ?? [],
    onFinish: () => {
      void queryClient.invalidateQueries(trpc.agent.listSessions.pathFilter());
      void queryClient.invalidateQueries(
        trpc.agent.getSessionHistory.queryFilter({ sessionId: sessionId ?? "" }),
      );
    },
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithApprovalResponses,
    throttle: 32,
    transport: new DefaultChatTransport({
      api: "/api/agent/chat",
      body: () => ({
        currentRepo,
        sessionId,
      }),
    }),
  });

  useEffect(() => {
    if (
      sessionId != null &&
      isSessionSaved === true &&
      history != null &&
      lastLoadedSessionIdRef.current !== sessionId
    ) {
      setMessages(
        history.map((msg) => ({
          createdAt: msg.createdAt,
          id: msg.id,
          parts: msg.parts,
          role: msg.role as "assistant" | "system" | "user",
        })),
      );
      lastLoadedSessionIdRef.current = sessionId;
      setIsAtBottom(true);
      requestAnimationFrame(() => {
        virtuosoRef.current?.scrollToIndex({ align: "end", behavior: "auto", index: "LAST" });
      });
    }
  }, [history, sessionId, isSessionSaved, setMessages]);

  useEffect(() => {
    const lastMessage = messages.at(-1);
    if (lastMessage?.role !== "assistant") {
      return;
    }

    lastMessage.parts.forEach((part) => {
      const isToolCall = typeof part.type === "string" && part.type.startsWith("tool-");
      if (isToolCall) {
        const toolPart = part as { state?: string; type: string };
        if (toolPart.state === "output-available") {
          const toolName = part.type.slice(5);
          void TOOL_INVALIDATIONS[toolName]?.({ queryClient, trpc });
        }
      }
    });
  }, [messages, queryClient, trpc]);

  const { open } = useSidebar();
  const { preferences } = useAppearancePreferences();
  const reduceMotion = useReducedMotion();

  const scrollToBottom = (behavior?: "auto" | "smooth") => {
    virtuosoRef.current?.scrollToIndex({
      align: "end",
      behavior: behavior ?? (reduceMotion ? "auto" : "smooth"),
      index: "LAST",
    });
  };

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) {
      return;
    }

    const filesList = Array.from(e.target.files);
    const newAttachments: LocalFileAttachment[] = [];

    for (const file of filesList) {
      const reader = new FileReader();

      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = (event) => resolve(event.target?.result as string);
        reader.onerror = () => reject(reader.error ?? new Error(t("file_read_failed")));
      });

      reader.readAsDataURL(file);
      const dataUrl = await base64Promise;

      newAttachments.push({
        contentType: file.type,
        name: file.name,
        url: dataUrl,
      });
    }

    setAttachments((prev) => [...prev, ...newAttachments]);
  };

  const submitMessage = async (parts: AgentMessagePart[]) => {
    // A second sendMessage mid-stream opens a concurrent turn; ignore it instead.
    if (submittingRef.current || status === "submitted" || status === "streaming") {
      return;
    }

    submittingRef.current = true;
    await sendMessage({
      createdAt: new Date(),
      parts,
      role: "user",
    }).catch(() => {
      // useChat exposes the failure through its error state.
    });
    submittingRef.current = false;
  };

  const handleCustomSubmit = async (e?: SyntheticEvent) => {
    e?.preventDefault();
    if (isHistoryLoading || (input.trim() === "" && attachments.length === 0)) {
      return;
    }

    const parts = buildMessageParts(input, attachments);
    setInput("");
    setAttachments([]);
    await submitMessage(parts);
  };

  const handleSuggestion = (prompt: string) => {
    if (isHistoryLoading) {
      return;
    }

    void submitMessage(buildMessageParts(prompt, []));
  };

  const handleNewChat = () => {
    const newId = crypto.randomUUID();
    void stop();
    setSessionId(newId);
    setMessages([]);
    setIsAtBottom(true);
    lastLoadedSessionIdRef.current = newId;
  };

  const handleSessionChange = (id: null | string) => {
    void stop();
    setSessionId(id);
    setIsAtBottom(true);
  };

  const handleSessionDeleted = (deletedSessionId: string) => {
    if (deletedSessionId === sessionId) {
      handleNewChat();
    }
  };

  const isLoading = status === "submitted" || status === "streaming" || isHistoryLoading;

  const renderMessage = (index: number, message: UIMessage) => {
    const isLastMessage = index === messages.length - 1;

    return (
      <AgentMessageRow
        addToolApprovalResponse={addToolApprovalResponse}
        editInput={editInput}
        isEditing={editingMessageId === message.id}
        isLast={isLastMessage}
        isStreaming={isLoading && message.role === "assistant" && isLastMessage}
        message={message}
        onCancelEdit={() => setEditingMessageId(null)}
        onEdit={(text) => {
          setEditingMessageId(message.id);
          setEditInput(text);
        }}
        onEditInputChange={setEditInput}
        onRegenerate={() => {
          void regenerate({ messageId: message.id });
        }}
        onSaveEdit={(text) => {
          void sendMessage({ messageId: message.id, text });
        }}
        toolLabelKeys={toolLabelKeys}
      />
    );
  };
  const isRepoOwnerPage = owner !== "" && name !== "";
  const openLeft =
    preferences.sidebarVariant === "floating"
      ? "left-[calc(var(--sidebar-width)+0.5rem)]"
      : "left-[calc(var(--sidebar-width)+1rem)]";
  const collapsedLeft =
    preferences.collapsible === "icon"
      ? preferences.sidebarVariant === "floating"
        ? "left-[calc(var(--sidebar-width-icon)+1.5rem+2px)]"
        : "left-[calc(var(--sidebar-width-icon)+1rem)]"
      : "left-4";

  const wrapperClasses = cn(
    "fixed z-50 flex overflow-hidden",
    // The panel is position:fixed and out of flow, so this reflows its own subtree only.
    "transition-[left] duration-300 ease-out-expo",
    "group-data-[resizing]/sidebar-wrapper:transition-none",
    expanded ? (open ? openLeft : collapsedLeft) : "left-[calc(100vw-450px)]",
  );

  const insets = expanded
    ? { bottom: 16, right: 16, top: isRepoOwnerPage ? 126 : 86 }
    : { bottom: 20, right: 20, top: "calc(100vh - 740px)" };

  return (
    <AnimatePresence>
      {isOpen ? (
        <motion.div
          animate={{ opacity: 1, y: 0 }}
          className={wrapperClasses}
          exit={{ opacity: 0, y: reduceMotion ? 0 : 8 }}
          initial={{ opacity: 0, y: reduceMotion ? 0 : 8 }}
          style={insets}
          transition={{ duration: 0.2, ease: [...EASING.out] }}
        >
          <aside
            aria-label={t("assistant_name")}
            className="flex h-full w-full"
          >
            <Card className="flex h-full w-full flex-col overflow-hidden p-0">
              <ResizablePanelGroup
                className="flex h-full"
                defaultLayout={defaultLayout}
                id="agent"
                key={expanded ? "expanded" : "collapsed"}
                onLayoutChanged={onLayoutChanged}
                orientation="horizontal"
              >
                {expanded && (
                  <>
                    <ResizablePanel
                      defaultSize="180px"
                      id="agent-sidebar"
                      maxSize="50%"
                      minSize="180px"
                    >
                      <AgentSidebar
                        onNewChat={handleNewChat}
                        onSessionDeleted={handleSessionDeleted}
                        sessionId={sessionId}
                        sessions={sessions}
                        setSessionId={handleSessionChange}
                      />
                    </ResizablePanel>
                    <ResizableHandle className="z-[9999]" />
                  </>
                )}

                <ResizablePanel
                  className="flex h-full flex-col"
                  defaultSize={expanded ? "85%" : "100%"}
                  id="agent-main"
                >
                  <AgentHeader
                    expanded={expanded}
                    setExpanded={setExpanded}
                  />

                  <div className="relative flex min-h-0 flex-1 flex-col">
                    {messages.length === 0 ? (
                      <Empty className="fade-in h-full animate-in border-0 pt-16">
                        <EmptyHeader>
                          <DxnxLogo className="size-40" />
                          <EmptyTitle>{t("assistant_name")}</EmptyTitle>
                          <EmptyDescription>{t("assistant_description")}</EmptyDescription>
                        </EmptyHeader>
                        <AgentSuggestions
                          hasRepo={currentRepo != null}
                          onSelect={handleSuggestion}
                        />
                      </Empty>
                    ) : (
                      <Virtuoso
                        atBottomStateChange={setIsAtBottom}
                        atBottomThreshold={80}
                        className="min-h-0 flex-1"
                        components={AGENT_LIST_COMPONENTS}
                        computeItemKey={computeMessageKey}
                        context={status}
                        data={messages}
                        followOutput="auto"
                        increaseViewportBy={INCREASE_VIEWPORT_BY}
                        initialTopMostItemIndex={INITIAL_TOP_MOST_ITEM_INDEX}
                        itemContent={renderMessage}
                        ref={virtuosoRef}
                      />
                    )}

                    <AppButton
                      aria-label={t("scroll_to_bottom")}
                      className={cn(
                        "absolute bottom-4 left-1/2 z-10 -translate-x-1/2",
                        !isAtBottom
                          ? "pointer-events-auto scale-100 opacity-100"
                          : "pointer-events-none scale-90 opacity-0",
                      )}
                      onClick={() => scrollToBottom()}
                      size="icon"
                      variant="secondary"
                    >
                      <ArrowDown />
                    </AppButton>
                  </div>

                  {error != null && (
                    <ActionErrorAlert
                      className="mx-4 mb-2"
                      error={error}
                      onDismiss={clearError}
                    />
                  )}

                  <AgentForm
                    attachments={attachments}
                    handleFileChange={(e) => {
                      void (async () => {
                        await handleFileChange(e);
                      })();
                    }}
                    input={input}
                    isLoading={isLoading}
                    onStop={() => {
                      void stop();
                    }}
                    onSubmit={(e) => {
                      void (async () => {
                        await handleCustomSubmit(e);
                      })();
                    }}
                    setAttachments={setAttachments}
                    setInput={setInput}
                  />
                </ResizablePanel>
              </ResizablePanelGroup>
            </Card>
          </aside>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
