"use client";

import { type ChangeEvent, type SyntheticEvent, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, lastAssistantMessageIsCompleteWithApprovalResponses } from "ai";
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
  loading: () => <div className="animate-pulse text-muted-foreground text-xs">Loading...</div>,
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
    { enabled: sessionId !== null && isOpen },
  );

  const { addToolApprovalResponse, messages, regenerate, sendMessage, setMessages, status } =
    useChat({
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
        })),
      );
      lastLoadedSessionIdRef.current = sessionId;
    }
  }, [history, sessionId, isSessionSaved, setMessages]);

  useEffect(() => {
    const lastMessage = messages.at(-1);
    if (lastMessage?.role !== "assistant") {
      return;
    }

    lastMessage.parts.forEach((part: any) => {
      const isToolCall = typeof part?.type === "string" && part.type.startsWith("tool-");
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
  }, [scrollRef]);

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
    if (input.trim() === "" && attachments.length === 0) {
      return;
    }

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
      createdAt: new Date(),
      parts: messageParts,
      role: "user",
    } as any);
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
    expanded ? (open ? "left-[272px]" : "left-4") : "left-[calc(100vw-450px)]",
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
          className={wrapperClasses}
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
        >
          <Card className="flex h-full w-full flex-col overflow-hidden p-0">
            <ResizablePanelGroup
              className="flex h-full"
              key={expanded ? "expanded" : "collapsed"}
              orientation="horizontal"
            >
              {expanded && (
                <>
                  <ResizablePanel defaultSize="15%" id="agent-sidebar" maxSize="50%" minSize="15%">
                    <AgentSidebar
                      onNewChat={handleNewChat}
                      sessionId={sessionId}
                      sessions={sessions}
                      setSessionId={setSessionId}
                    />
                  </ResizablePanel>
                  <ResizableHandle style={{ position: "relative", zIndex: 9999 }} />
                </>
              )}

              <ResizablePanel
                className="flex h-full flex-col"
                defaultSize={expanded ? "85%" : "100%"}
                id="agent-main"
              >
                <AgentHeader expanded={expanded} setExpanded={setExpanded} />

                <div className="group relative flex min-h-0 flex-1 flex-col">
                  <ScrollArea className="h-full min-h-0 flex-1" ref={scrollRef}>
                    {messages.length === 0 && !isHistoryLoading && (
                      <div className="fade-in pointer-events-none flex animate-in select-none flex-col items-center gap-3 pt-24">
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
                            .filter(
                              (p: any): p is { text: string; type: "text" } => p?.type === "text",
                            )
                            .map((p: any) => p.text)
                            .join("\n") || "";

                        const isAssistant = message.role === "assistant";
                        const isEditing = editingMessageId === message.id;

                        return (
                          <div
                            className="group fade-in flex w-full animate-in flex-col gap-2 border-b py-5 duration-300 last:border-0"
                            key={message.id}
                          >
                            <div
                              className={cn(
                                "flex items-center gap-2 font-semibold text-muted-foreground text-xs",
                                isAssistant ? "justify-start" : "justify-end",
                              )}
                            >
                              {isAssistant ? <Bot /> : <UserRound />}
                              <span>{isAssistant ? "Dxnx_" : "You"}</span>
                            </div>

                            {isEditing ? (
                              <div className="fade-in ml-auto flex w-full animate-in flex-col gap-2 duration-200">
                                <Textarea
                                  className="max-h-32 min-h-16 resize-none rounded-xl border p-2 text-xs"
                                  onChange={(e) => setEditInput(e.target.value)}
                                  value={editInput}
                                />
                                <div className="flex items-center justify-end gap-1.5">
                                  <AppButton
                                    className="text-xs"
                                    onClick={() => {
                                      void (async () => {
                                        if (editInput.trim() === "") {
                                          return;
                                        }
                                        setEditingMessageId(null);
                                        await sendMessage({
                                          messageId: message.id,
                                          text: editInput,
                                        });
                                      })();
                                    }}
                                    size="sm"
                                  >
                                    Save & Submit
                                  </AppButton>
                                  <AppButton
                                    className="text-xs"
                                    onClick={() => setEditingMessageId(null)}
                                    size="sm"
                                    variant="ghost"
                                  >
                                    Cancel
                                  </AppButton>
                                </div>
                              </div>
                            ) : (
                              <div
                                className={cn(
                                  "flex flex-col gap-3 text-foreground text-sm",
                                  isAssistant ? "mr-auto text-left" : "ml-auto text-right",
                                )}
                              >
                                {message.parts.map((rawPart: any, index: number) => {
                                  const part = rawPart as MessagePart;

                                  if (part.type === "reasoning") {
                                    const reasoningPart = part as {
                                      text: string;
                                      type: "reasoning";
                                    };
                                    const partKey = `${message.id}-reasoning-${index}`;
                                    return (
                                      <Collapsible
                                        className="group/collapsible my-1 rounded-r-lg border-l-2 pl-3 text-muted-foreground text-xs italic"
                                        key={partKey}
                                      >
                                        <div className="flex items-center justify-between gap-1">
                                          <div className="font-semibold text-xs uppercase">
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
                                            content={reasoningPart.text}
                                            id={partKey}
                                            isStreaming={isLoading}
                                            key={`${partKey}-md`}
                                          />
                                        </CollapsibleContent>
                                      </Collapsible>
                                    );
                                  }

                                  if (part.type.startsWith("tool-")) {
                                    return (
                                      <ToolCallIndicator
                                        addToolApprovalResponse={(e) =>
                                          void addToolApprovalResponse(e)
                                        }
                                        key={`${message.id}-tool-${index}`}
                                        part={part}
                                        toolLabels={toolLabels}
                                      />
                                    );
                                  }

                                  if (part.type === "text") {
                                    const textPart = part as { text: string; type: "text" };
                                    return (
                                      <MarkdownRenderer
                                        content={textPart.text}
                                        id={`${message.id}-text-${index}`}
                                        isStreaming={isLoading}
                                        key={`${message.id}-text-${index}`}
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
                                        className={cn(
                                          "my-2 max-w-50 overflow-hidden rounded-xl border bg-background",
                                          isAssistant ? "mr-auto" : "ml-auto",
                                        )}
                                        key={`${message.id}-file-${index}`}
                                      >
                                        {isImage ? (
                                          <Image
                                            alt={filePart.filename ?? "Attachment"}
                                            className="h-auto max-h-38 w-full object-cover"
                                            height={200}
                                            src={filePart.url}
                                            width={200}
                                          />
                                        ) : (
                                          <div className="flex items-center gap-2 p-3 text-foreground text-xs">
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
                                isAssistant ? "justify-start" : "justify-end",
                              )}
                            >
                              {fullMessageText.trim() !== "" && (
                                <>
                                  <CopyButton
                                    className="size-9 px-3"
                                    tooltipText="Copy response"
                                    value={fullMessageText}
                                  />
                                  <AppTooltip content="Retry">
                                    <AppButton
                                      className="opacity-0 group-hover:opacity-100"
                                      disabled={isLoading}
                                      onClick={() => {
                                        void (async () => {
                                          await regenerate({ messageId: message.id });
                                        })();
                                      }}
                                      size="icon"
                                      variant="ghost"
                                    >
                                      <RotateCw />
                                    </AppButton>
                                  </AppTooltip>
                                </>
                              )}

                              {!isAssistant && !isEditing && (
                                <AppButton
                                  className="opacity-0 group-hover:opacity-100"
                                  onClick={() => {
                                    setEditingMessageId(message.id);
                                    setEditInput(fullMessageText);
                                  }}
                                  size="icon"
                                  variant="ghost"
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
                    className={cn(
                      "absolute bottom-4 left-1/2 z-10 -translate-x-1/2",
                      showScrollButton
                        ? "pointer-events-auto scale-100 opacity-100"
                        : "pointer-events-none scale-90 opacity-0",
                    )}
                    onClick={() => scrollToBottom("smooth")}
                    size="icon"
                    variant="secondary"
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
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
