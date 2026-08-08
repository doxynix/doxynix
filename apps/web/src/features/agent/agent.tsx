"use client";

import { useEffect, useRef, useState, type ChangeEvent, type SyntheticEvent } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { useChat } from "@ai-sdk/react";
import {
  DefaultChatTransport,
  lastAssistantMessageIsCompleteWithApprovalResponses,
  type UIMessage,
} from "ai";
import { ArrowDown, Bot, ChevronDown, FileText, Pencil, RotateCw, UserRound } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

import { trpc } from "@/shared/api/trpc";
import { useAutoScroll } from "@/shared/hooks/use-auto-scroll";
import { cn } from "@/shared/lib/cn";
import { DxnxLogo } from "@/shared/ui/branding/dxnx-logo";
import { AppButton } from "@/shared/ui/core/button";
import { Card } from "@/shared/ui/core/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/shared/ui/core/collapsible";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/shared/ui/core/resizable";
import { ScrollArea } from "@/shared/ui/core/scroll-area";
import { useSidebar } from "@/shared/ui/core/sidebar";
import { Textarea } from "@/shared/ui/core/textarea";
import { AppTooltip } from "@/shared/ui/kit/app-tooltip";
import { CopyButton } from "@/shared/ui/kit/copy-button";

import { useRepoParams } from "@/entities/repo/model/use-repo-params";

import { AgentForm } from "./agent-form";
import { AgentHeader } from "./agent-header";
import { AgentSidebar } from "./agent-sidebar";
import { TOOL_INVALIDATIONS, toolLabels } from "./model/agent-config";
import { useAgentIsOpen } from "./model/use-agent.store";
import { ToolCallIndicator } from "./tool-call-indicator";

type MessagePart =
  | { [key: string]: unknown; state: string; type: string }
  | { filename?: string; mediaType: string; type: "file"; url: string }
  | { text: string; type: "reasoning" }
  | { text: string; type: "text" };

type LocalFileAttachment = {
  contentType: string;
  name: string;
  url: string;
};

const MarkdownRenderer = dynamic(() => import("./agent-text-message").then((mod) => mod.default), {
  loading: () => <div className="text-muted-foreground animate-pulse text-xs">Loading...</div>,
  ssr: false,
});

export function Agent() {
  const isOpen = useAgentIsOpen();

  const [expanded, setExpanded] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<null | string>(null);
  const [editInput, setEditInput] = useState("");
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<LocalFileAttachment[]>([]);

  const { name, owner } = useRepoParams();
  const currentRepo = owner && name ? { name, owner } : undefined;

  const [sessionId, setSessionId] = useState<null | string>(() => crypto.randomUUID());

  const lastLoadedSessionIdRef = useRef<null | string>(sessionId);

  const utils = trpc.useUtils();

  const { data: sessions } = trpc.agent.listSessions.useQuery({ currentRepo }, { enabled: isOpen });

  const isSessionSaved = sessions?.some((s) => s.id === sessionId);

  const { data: history, isLoading: isHistoryLoading } = trpc.agent.getSessionHistory.useQuery(
    { sessionId: sessionId ?? "" },
    { enabled: sessionId !== null && isOpen }
  );

  const { addToolApprovalResponse, messages, regenerate, sendMessage, setMessages, status } =
    useChat<UIMessage>({
      experimental_throttle: 50,
      id: sessionId ?? undefined,
      messages:
        history?.map((msg) => ({
          createdAt: msg.createdAt,
          id: msg.id,
          parts: msg.parts,
          role: msg.role as "assistant" | "system" | "user",
        })) ?? [],
      onFinish: () => {
        void utils.agent.listSessions.invalidate();
        void utils.agent.getSessionHistory.invalidate({ sessionId: sessionId ?? "" });
      },
      sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithApprovalResponses,
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
        }))
      );
      lastLoadedSessionIdRef.current = sessionId;
    }
  }, [history, sessionId, isSessionSaved, setMessages]);

  useEffect(() => {
    const lastMessage = messages.at(-1);
    if (lastMessage == null || lastMessage.role !== "assistant") return;

    lastMessage.parts.forEach((part) => {
      const isToolCall = part.type.startsWith("tool-");
      if (isToolCall) {
        const toolPart = part as { state?: string; type: string };
        if (toolPart.state === "output-available") {
          const toolName = part.type.slice(5);
          TOOL_INVALIDATIONS[toolName]?.(utils);
        }
      }
    });
  }, [messages, utils]);

  const { scrollRef, scrollToBottom, showScrollButton } = useAutoScroll<HTMLDivElement>([messages]);
  const { open } = useSidebar();

  useEffect(() => {
    const element = scrollRef.current;
    if (element != null) {
      element.scrollTo({ top: element.scrollHeight });
    }
  }, [messages, scrollRef]);

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;

    const filesList = Array.from(e.target.files);
    const newAttachments: LocalFileAttachment[] = [];

    for (const file of filesList) {
      const reader = new FileReader();

      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = (event) => resolve(event.target?.result as string);
        reader.onerror = () => reject(reader.error ?? new Error("File read failed"));
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

  const handleCustomSubmit = async (e?: SyntheticEvent) => {
    e?.preventDefault();
    if (input.trim() === "" && attachments.length === 0) return;

    const userMessage = input;
    const currentAttachments = attachments;
    setInput("");
    setAttachments([]);

    const messageParts: MessagePart[] = [];
    if (userMessage.trim() !== "") {
      messageParts.push({ text: userMessage, type: "text" });
    }
    currentAttachments.forEach((file) => {
      messageParts.push({
        filename: file.name,
        mediaType: file.contentType,
        type: "file",
        url: file.url,
      });
    });
    await sendMessage({
      parts: messageParts as UIMessage["parts"],
      role: "user",
    });
  };

  const handleNewChat = () => {
    const newId = crypto.randomUUID();
    setSessionId(newId);
    setMessages([]);
    lastLoadedSessionIdRef.current = newId;
  };

  const isLoading = status === "submitted" || status === "streaming" || isHistoryLoading;
  const isRepoOwnerPage = owner !== "" && name !== "";
  const wrapperClasses = cn(
    "fixed z-50 flex overflow-hidden",
    "transition-[left] duration-200 ease-linear",
    expanded ? (open ? "left-[272px]" : "left-4") : "left-[calc(100vw-450px)]"
  );

  return (
    <AnimatePresence>
      {isOpen ? (
        <motion.div
          animate={{
            bottom: expanded ? 16 : 20,
            opacity: 1,
            right: expanded ? 16 : 20,
            top: expanded ? (isRepoOwnerPage ? 126 : 86) : "calc(100vh - 740px)",
            y: 0,
          }}
          exit={{
            opacity: 0,
            y: 12,
          }}
          initial={{
            bottom: 20,
            opacity: 0,
            right: 20,
            top: "calc(100vh - 740px)",
            y: 12,
          }}
          transition={{
            duration: 0.24,
            ease: "easeInOut",
            type: "tween",
          }}
          className={wrapperClasses}
        >
          <Card className="flex h-full w-full flex-col overflow-hidden p-0">
            <ResizablePanelGroup
              key={expanded ? "expanded" : "collapsed"}
              orientation="horizontal"
              className="flex h-full"
            >
              {expanded && (
                <>
                  <ResizablePanel id="agent-sidebar" defaultSize="15%" maxSize="50%" minSize="15%">
                    <AgentSidebar
                      sessionId={sessionId}
                      sessions={sessions}
                      setSessionId={setSessionId}
                      onNewChat={handleNewChat}
                    />
                  </ResizablePanel>
                  <ResizableHandle style={{ position: "relative", zIndex: 9999 }} />
                </>
              )}

              <ResizablePanel
                id="agent-main"
                defaultSize={expanded ? "85%" : "100%"}
                className="flex h-full flex-col"
              >
                <AgentHeader expanded={expanded} setExpanded={setExpanded} />

                <div className="group relative flex min-h-0 flex-1 flex-col">
                  <ScrollArea ref={scrollRef} className="h-full min-h-0 flex-1">
                    {messages.length === 0 && !isHistoryLoading && (
                      <div className="animate-in fade-in pointer-events-none flex flex-col items-center gap-3 pt-24 select-none">
                        <DxnxLogo className="size-64" />
                        <p className="text-muted-foreground text-sm">
                          Autonomous repository engineering assistant
                        </p>
                      </div>
                    )}
                    <div className="flex flex-col gap-4 p-4">
                      {messages.map((message) => {
                        const fullMessageText =
                          message.parts
                            .filter((p): p is { text: string; type: "text" } => p.type === "text")
                            .map((p) => p.text)
                            .join("\n") || "";

                        const isAssistant = message.role === "assistant";
                        const isEditing = editingMessageId === message.id;

                        return (
                          <div
                            key={message.id}
                            className="group animate-in fade-in flex w-full flex-col gap-2 border-b py-5 duration-300 last:border-0"
                          >
                            <div
                              className={cn(
                                "text-muted-foreground flex items-center gap-2 text-xs font-semibold",
                                isAssistant ? "justify-start" : "justify-end"
                              )}
                            >
                              {isAssistant ? <Bot /> : <UserRound />}
                              <span>{isAssistant ? "Dxnx_" : "You"}</span>
                            </div>

                            {isEditing ? (
                              <div className="animate-in fade-in ml-auto flex w-full flex-col gap-2 duration-200">
                                <Textarea
                                  value={editInput}
                                  onChange={(e) => setEditInput(e.target.value)}
                                  className="max-h-32 min-h-16 resize-none rounded-xl border p-2 text-xs"
                                />
                                <div className="flex items-center justify-end gap-1.5">
                                  <AppButton
                                    size="sm"
                                    onClick={() => {
                                      void (async () => {
                                        if (editInput.trim() === "") return;
                                        setEditingMessageId(null);
                                        await sendMessage({
                                          messageId: message.id,
                                          text: editInput,
                                        });
                                      })();
                                    }}
                                    className="text-xs"
                                  >
                                    Save & Submit
                                  </AppButton>
                                  <AppButton
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => setEditingMessageId(null)}
                                    className="text-xs"
                                  >
                                    Cancel
                                  </AppButton>
                                </div>
                              </div>
                            ) : (
                              <div
                                className={cn(
                                  "text-foreground flex flex-col gap-3 text-sm",
                                  isAssistant ? "mr-auto text-left" : "ml-auto text-right"
                                )}
                              >
                                {message.parts.map((rawPart, index) => {
                                  const part = rawPart as MessagePart;

                                  if (part.type === "reasoning") {
                                    const reasoningPart = part as {
                                      text: string;
                                      type: "reasoning";
                                    };
                                    const partKey = `${message.id}-reasoning-${index}`;
                                    return (
                                      <Collapsible
                                        key={partKey}
                                        className="group/collapsible text-muted-foreground my-1 rounded-r-lg border-l-2 pl-3 text-xs italic"
                                      >
                                        <div className="flex items-center justify-between gap-1">
                                          <div className="text-xs font-semibold uppercase">
                                            Thinking Process
                                          </div>
                                          <CollapsibleTrigger asChild>
                                            <AppButton size="icon" variant="ghost">
                                              <ChevronDown className="group-data-[state=open]/collapsible:rotate-180" />
                                            </AppButton>
                                          </CollapsibleTrigger>
                                        </div>
                                        <CollapsibleContent>
                                          <MarkdownRenderer
                                            key={`${partKey}-md`}
                                            id={partKey}
                                            content={reasoningPart.text}
                                            isStreaming={isLoading}
                                          />
                                        </CollapsibleContent>
                                      </Collapsible>
                                    );
                                  }

                                  if (part.type.startsWith("tool-")) {
                                    return (
                                      <ToolCallIndicator
                                        key={`${message.id}-tool-${index}`}
                                        addToolApprovalResponse={(e) =>
                                          void addToolApprovalResponse(e)
                                        }
                                        part={part}
                                        toolLabels={toolLabels}
                                      />
                                    );
                                  }

                                  if (part.type === "text") {
                                    const textPart = part as { text: string; type: "text" };
                                    return (
                                      <MarkdownRenderer
                                        key={`${message.id}-text-${index}`}
                                        id={`${message.id}-text-${index}`}
                                        content={textPart.text}
                                        isStreaming={isLoading}
                                      />
                                    );
                                  }

                                  if (part.type === "file") {
                                    const filePart = part as {
                                      filename?: string;
                                      mediaType: string;
                                      type: "file";
                                      url: string;
                                    };
                                    const isImage = filePart.mediaType.startsWith("image/");

                                    return (
                                      <div
                                        key={`${message.id}-file-${index}`}
                                        className={cn(
                                          "bg-background my-2 max-w-50 overflow-hidden rounded-xl border",
                                          isAssistant ? "mr-auto" : "ml-auto"
                                        )}
                                      >
                                        {isImage === true ? (
                                          <Image
                                            alt={filePart.filename ?? "Attachment"}
                                            src={filePart.url}
                                            height={200}
                                            width={200}
                                            className="h-auto max-h-38 w-full object-cover"
                                          />
                                        ) : (
                                          <div className="text-foreground flex items-center gap-2 p-3 text-xs">
                                            <FileText />
                                            <span className="truncate font-medium">
                                              {filePart.filename ?? "Document"}
                                            </span>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  }

                                  return null;
                                })}
                              </div>
                            )}

                            <div
                              className={cn(
                                "mt-1 flex items-center gap-1.5",
                                isAssistant ? "justify-start" : "justify-end"
                              )}
                            >
                              {fullMessageText.trim() !== "" && (
                                <>
                                  <CopyButton
                                    value={fullMessageText}
                                    tooltipText="Copy response"
                                    className="size-9 px-3"
                                  />
                                  <AppTooltip content="Retry">
                                    <AppButton
                                      disabled={isLoading}
                                      size="icon"
                                      variant="ghost"
                                      onClick={() => {
                                        void (async () => {
                                          await regenerate({ messageId: message.id });
                                        })();
                                      }}
                                      className="opacity-0 group-hover:opacity-100"
                                    >
                                      <RotateCw />
                                    </AppButton>
                                  </AppTooltip>
                                </>
                              )}

                              {!isAssistant && !isEditing && (
                                <AppButton
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => {
                                    setEditingMessageId(message.id);
                                    setEditInput(fullMessageText);
                                  }}
                                  className="opacity-0 group-hover:opacity-100"
                                >
                                  <Pencil />
                                </AppButton>
                              )}
                            </div>
                          </div>
                        );
                      })}
                      {status === "submitted" && (
                        <p className="text-muted-foreground text-xs">Thinking...</p>
                      )}
                    </div>
                  </ScrollArea>

                  <AppButton
                    size="icon"
                    variant="secondary"
                    onClick={() => scrollToBottom("smooth")}
                    className={cn(
                      "absolute bottom-4 left-1/2 z-10 -translate-x-1/2",
                      showScrollButton
                        ? "pointer-events-auto scale-100 opacity-100"
                        : "pointer-events-none scale-90 opacity-0"
                    )}
                  >
                    <ArrowDown />
                  </AppButton>
                </div>

                <AgentForm
                  attachments={attachments}
                  handleFileChange={(e) => {
                    void (async () => {
                      await handleFileChange(e);
                    })();
                  }}
                  input={input}
                  isLoading={isLoading}
                  setAttachments={setAttachments}
                  setInput={setInput}
                  onSubmit={(e) => {
                    void (async () => {
                      await handleCustomSubmit(e);
                    })();
                  }}
                />
              </ResizablePanel>
            </ResizablePanelGroup>
          </Card>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
