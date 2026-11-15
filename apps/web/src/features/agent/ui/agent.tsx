"use client";
import { type ChangeEvent, type SyntheticEvent, useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import type { ChatStatus, UIMessage } from "ai";
import { DefaultChatTransport, lastAssistantMessageIsCompleteWithApprovalResponses } from "ai";
import { ArrowDown, LoaderCircle } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useTranslations } from "next-intl";
import { type Components, Virtuoso, type VirtuosoHandle } from "react-virtuoso";

import { type RouterOutput, useTRPC } from "@/shared/api/trpc";
import { EASING } from "@/shared/config/motion";
import { cn } from "@/shared/lib/cn";
import { useAppearancePreferences } from "@/shared/lib/hooks/use-appearance-preferences";
import { usePanelLayout } from "@/shared/lib/hooks/use-panel-layout";
import { DxnxLogo } from "@/shared/ui/branding/dxnx-logo";
import { AppButton } from "@/shared/ui/core/button";
import { Card } from "@/shared/ui/core/card";
import { Empty, EmptyDescription, EmptyHeader } from "@/shared/ui/core/empty";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/shared/ui/core/resizable";
import { useSidebar } from "@/shared/ui/core/sidebar";
import { ActionErrorAlert } from "@/shared/ui/kit/action-error-alert";
import { AnimatedShinyText } from "@/shared/ui/visuals/animated-shiny-text";

import { useRepoParams } from "@/entities/repo/model/use-repo-params";

import { TOOL_INVALIDATIONS, toolLabelKeys } from "../model/agent-config";
import type { AgentMessagePart, LocalFileAttachment } from "../model/agent-types";
import {
  decidePrepend,
  filterNewMessages,
  type HistoryWindow,
  resetHistoryWindow,
} from "../model/history-window";
import { flattenSessionPages } from "../model/session-pages";
import { useAgentIsOpen } from "../model/use-agent.store";
import { AgentForm } from "./agent-form";
import { AgentHeader } from "./agent-header";
import { AgentMessageRow } from "./agent-message";
import { AgentSidebar } from "./agent-sidebar";
import { AgentSuggestions } from "./agent-suggestions";

const HISTORY_PAGE_SIZE = 100;
const SESSION_PAGE_SIZE = 50;

type HistoryItem = RouterOutput["agent"]["getSessionHistory"]["items"][number];

// `submitMessage` stamps `createdAt`, so the chat message type has to carry it.
type AgentUIMessage = UIMessage & { createdAt: Date };

function toUIMessages(items: readonly HistoryItem[]): AgentUIMessage[] {
  return items.map((message) => ({
    createdAt: message.createdAt,
    id: message.id,
    parts: message.parts,
    role: message.role as "assistant" | "system" | "user",
  }));
}

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

type AgentListContext = {
  isFetchingNextPage: boolean;
  status: ChatStatus;
};

function AgentListFooter({ context }: Readonly<{ context?: AgentListContext }>) {
  const t = useTranslations("Agent");

  if (context?.status !== "submitted") {
    return null;
  }

  return (
    <div className="px-4 pb-2">
      <AnimatedShinyText className="mx-0 self-start text-xs">{t("thinking")}</AnimatedShinyText>
    </div>
  );
}

function AgentListHeader({ context }: Readonly<{ context?: AgentListContext }>) {
  if (context?.isFetchingNextPage !== true) {
    return null;
  }

  return (
    <div className="flex justify-center py-2">
      <LoaderCircle
        aria-hidden
        className="size-4 animate-spin text-muted-foreground"
      />
    </div>
  );
}

// Hoisted so Virtuoso never remounts its header and footer when the panel re-renders.
const AGENT_LIST_COMPONENTS: Components<UIMessage, AgentListContext> = {
  Footer: AgentListFooter,
  Header: AgentListHeader,
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

  const [storedWindow, setHistoryWindow] = useState<HistoryWindow>(resetHistoryWindow);

  const queryClient = useQueryClient();
  // Guards against two submits in the same tick, where `status` from the last render is stale.
  const submittingRef = useRef(false);

  const {
    data: sessionPages,
    fetchNextPage: fetchNextSessionPage,
    hasNextPage: hasMoreSessions,
    isFetchingNextPage: isFetchingNextSessionPage,
  } = useInfiniteQuery(
    trpc.agent.listSessions.infiniteQueryOptions(
      { currentRepo, limit: SESSION_PAGE_SIZE },
      { enabled: isOpen, getNextPageParam: (page) => page.meta.nextCursor },
    ),
  );

  const sessions = sessionPages == null ? undefined : flattenSessionPages(sessionPages.pages);

  const {
    data: historyPages,
    fetchNextPage: fetchOlderHistory,
    hasNextPage: hasOlderHistory,
    isFetchingNextPage: isFetchingOlderHistory,
    isPending: isHistoryLoading,
  } = useInfiniteQuery(
    trpc.agent.getSessionHistory.infiniteQueryOptions(
      { limit: HISTORY_PAGE_SIZE, sessionId: sessionId ?? "" },
      {
        enabled: isOpen && sessionId != null,
        getNextPageParam: (page) => page.meta.nextCursor,
      },
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
    messages: toUIMessages(historyPages?.pages[0]?.items ?? []),
    onFinish: () => {
      void queryClient.invalidateQueries(trpc.agent.listSessions.pathFilter());
      void queryClient.invalidateQueries(
        trpc.agent.getSessionHistory.infiniteQueryFilter({ sessionId: sessionId ?? "" }),
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

  const messagesRef = useRef(messages);

  // Declared before the prepend effect so the transcript ids it dedupes against are never stale.
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // Seeding the count is independent of the message reset: a chat created in this mount streams its
  // own messages and must still be able to prepend once it outgrows page 0.
  useEffect(() => {
    const firstPage = historyPages?.pages[0];

    if (firstPage == null || lastLoadedSessionIdRef.current === sessionId) {
      return;
    }

    setMessages(toUIMessages(firstPage.items));
    lastLoadedSessionIdRef.current = sessionId;
    setIsAtBottom(true);
    requestAnimationFrame(() => {
      virtuosoRef.current?.scrollToIndex({ align: "end", behavior: "auto", index: "LAST" });
    });
  }, [historyPages, sessionId, setMessages]);

  useEffect(() => {
    if (historyPages == null) {
      return;
    }

    const currentIds = new Set(messagesRef.current.map((message) => message.id));
    const { items, window } = decidePrepend(storedWindow, historyPages.pages, currentIds);

    if (window === storedWindow) {
      return;
    }

    if (items.length > 0) {
      // The inner filter only guards a race: a drop there would under-count the index shift by one.
      setMessages((previous) => [
        ...toUIMessages(filterNewMessages(items, new Set(previous.map((message) => message.id)))),
        ...previous,
      ]);
    }

    // oxlint-disable-next-line react/set-state-in-effect -- the window mirrors useChat state.
    setHistoryWindow((previous) => decidePrepend(previous, historyPages.pages, currentIds).window);
  }, [historyPages, setMessages, storedWindow]);

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
    setHistoryWindow(resetHistoryWindow());
  };

  const handleSessionChange = (id: null | string) => {
    // Re-clicking the open chat is not a session change; resetting here would strand the window.
    if (id === sessionId) {
      return;
    }

    void stop();
    setSessionId(id);
    setIsAtBottom(true);
    setHistoryWindow(resetHistoryWindow());
  };

  const handleSessionDeleted = (deletedSessionId: string) => {
    if (deletedSessionId === sessionId) {
      handleNewChat();
    }
  };

  const isLoading = status === "submitted" || status === "streaming" || isHistoryLoading;

  const listContext = useMemo<AgentListContext>(
    () => ({ isFetchingNextPage: isFetchingOlderHistory, status }),
    [isFetchingOlderHistory, status],
  );

  // Virtuoso indices are shifted by `firstItemIndex`, so the newest message is found by id.
  const lastMessageId = messages.at(-1)?.id;

  const renderMessage = (_index: number, message: UIMessage) => {
    const isLastMessage = message.id === lastMessageId;

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
                        fetchNextPage={fetchNextSessionPage}
                        hasNextPage={hasMoreSessions}
                        isFetchingNextPage={isFetchingNextSessionPage}
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
                        context={listContext}
                        data={messages}
                        firstItemIndex={storedWindow.firstItemIndex}
                        followOutput="auto"
                        increaseViewportBy={INCREASE_VIEWPORT_BY}
                        initialTopMostItemIndex={INITIAL_TOP_MOST_ITEM_INDEX}
                        itemContent={renderMessage}
                        ref={virtuosoRef}
                        startReached={() => {
                          if (hasOlderHistory && !isFetchingOlderHistory) {
                            void fetchOlderHistory();
                          }
                        }}
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
                      className="mx-4 mb-2 w-auto"
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
