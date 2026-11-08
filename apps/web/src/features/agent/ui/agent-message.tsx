"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import type { FileUIPart, ReasoningUIPart, TextUIPart, UIMessage } from "ai";
import { Bot, FileText, Pencil, RotateCw, UserRound } from "lucide-react";
import { useTranslations } from "next-intl";

import { cn } from "@/shared/lib/cn";
import {
  Attachment,
  AttachmentContent,
  AttachmentGroup,
  AttachmentMedia,
  AttachmentTitle,
} from "@/shared/ui/core/attachment";
import { Bubble, BubbleContent } from "@/shared/ui/core/bubble";
import { AppButton } from "@/shared/ui/core/button";
import { Message, MessageContent, MessageFooter, MessageHeader } from "@/shared/ui/core/message";
import { Textarea } from "@/shared/ui/core/textarea";
import { AppTooltip } from "@/shared/ui/kit/app-tooltip";
import { CopyButton } from "@/shared/ui/kit/copy-button";

import type { AgentToolLabelKey } from "../model/agent-config";
import { type ActivityStep, AgentChainOfThought } from "./agent-chain-of-thought";
import { type AgentToolPart, ToolCallIndicator } from "./tool-call-indicator";

type MessagePart = UIMessage["parts"][number];

type Group =
  | { key: string; kind: "activity"; steps: ActivityStep[] }
  | { key: string; kind: "approval"; part: AgentToolPart }
  | { key: string; kind: "file"; parts: FileUIPart[] }
  | { key: string; kind: "text"; part: TextUIPart };

type Props = {
  addToolApprovalResponse: (options: { approved: boolean; id: string; reason?: string }) => void;
  editInput: string;
  isEditing: boolean;
  isLast: boolean;
  isStreaming: boolean;
  message: UIMessage;
  onCancelEdit: () => void;
  onEdit: (text: string) => void;
  onEditInputChange: (value: string) => void;
  onRegenerate: () => void;
  onSaveEdit: (text: string) => void;
  toolLabelKeys: Record<string, AgentToolLabelKey>;
};

function MarkdownLoading() {
  const t = useTranslations("Agent");

  return <div className="animate-pulse text-muted-foreground text-xs">{t("agent_loading")}</div>;
}

const MarkdownRenderer = dynamic(() => import("./agent-text-message").then((mod) => mod.default), {
  loading: () => <MarkdownLoading />,
  ssr: false,
});

function isToolPart(part: MessagePart): part is AgentToolPart {
  return part.type === "dynamic-tool" || part.type.startsWith("tool-");
}

function groupParts(parts: MessagePart[]): Group[] {
  const groups: Group[] = [];

  for (const [index, part] of parts.entries()) {
    if (isToolPart(part) && part.state === "approval-requested") {
      groups.push({ key: `approval-${index}`, kind: "approval", part });
      continue;
    }

    if (part.type === "reasoning" || isToolPart(part)) {
      const step: ActivityStep =
        part.type === "reasoning"
          ? { key: `reasoning-${index}`, kind: "reasoning", part }
          : { key: `tool-${index}`, kind: "tool", part };

      const last = groups.at(-1);

      if (last?.kind === "activity") {
        last.steps.push(step);
      } else {
        groups.push({ key: `activity-${index}`, kind: "activity", steps: [step] });
      }

      continue;
    }

    if (part.type === "text") {
      groups.push({ key: `text-${index}`, kind: "text", part });
      continue;
    }

    if (part.type === "file") {
      const last = groups.at(-1);

      if (last?.kind === "file") {
        last.parts.push(part);
      } else {
        groups.push({ key: `file-${index}`, kind: "file", parts: [part] });
      }
    }
  }

  return groups;
}

function messageText(message: UIMessage): string {
  return (
    message.parts
      .filter((part): part is TextUIPart => part.type === "text")
      .map((part) => part.text)
      .join("\n") || ""
  );
}

export function AgentMessageRow({
  addToolApprovalResponse,
  editInput,
  isEditing,
  isLast,
  isStreaming,
  message,
  onCancelEdit,
  onEdit,
  onEditInputChange,
  onRegenerate,
  onSaveEdit,
  toolLabelKeys,
}: Readonly<Props>) {
  const t = useTranslations("Agent");
  const tCommon = useTranslations("Common");

  const isAssistant = message.role === "assistant";
  const fullText = messageText(message);
  const groups = groupParts(message.parts);

  const renderReasoning = (part: ReasoningUIPart) => (
    <MarkdownRenderer
      content={part.text}
      id={`${message.id}-reasoning`}
      isStreaming={part.state === "streaming"}
    />
  );

  return (
    <Message
      align={isAssistant ? "start" : "end"}
      className={cn(
        "group fade-in w-full animate-in border-b px-4 py-5 duration-300",
        isLast && "border-b-0",
      )}
    >
      <MessageContent className="gap-2">
        <MessageHeader className={cn("px-0", !isAssistant && "justify-end")}>
          {isAssistant ? <Bot className="size-3.5" /> : <UserRound className="size-3.5" />}
          <span>{isAssistant ? t("assistant_name") : t("you")}</span>
        </MessageHeader>

        {isEditing ? (
          <div className="fade-in ml-auto flex w-full animate-in flex-col gap-2 duration-200">
            <Textarea
              className="max-h-32 min-h-16 resize-none rounded-xl border p-2 text-xs"
              onChange={(e) => onEditInputChange(e.target.value)}
              value={editInput}
            />
            <div className="flex items-center justify-end gap-1.5">
              <AppButton
                className="text-xs"
                onClick={() => {
                  if (editInput.trim() === "") {
                    return;
                  }

                  onCancelEdit();
                  onSaveEdit(editInput);
                }}
                size="sm"
              >
                {t("save_and_submit")}
              </AppButton>
              <AppButton
                className="text-xs"
                onClick={onCancelEdit}
                size="sm"
                variant="ghost"
              >
                {tCommon("cancel")}
              </AppButton>
            </div>
          </div>
        ) : (
          <div
            className={cn("flex max-w-full flex-col gap-3 text-sm", !isAssistant && "items-end")}
          >
            {groups.map((group, index) => {
              if (group.kind === "approval") {
                return (
                  <ToolCallIndicator
                    addToolApprovalResponse={addToolApprovalResponse}
                    isStreaming={isStreaming}
                    key={group.key}
                    part={group.part}
                    toolLabelKeys={toolLabelKeys}
                  />
                );
              }

              if (group.kind === "activity") {
                const isAnswering = groups
                  .slice(index + 1)
                  .some((next) => next.kind === "text" && next.part.text !== "");

                return (
                  <AgentChainOfThought
                    addToolApprovalResponse={addToolApprovalResponse}
                    isAnswering={isAnswering}
                    isStreaming={isStreaming}
                    key={group.key}
                    renderReasoning={renderReasoning}
                    steps={group.steps}
                    toolLabelKeys={toolLabelKeys}
                  />
                );
              }

              if (group.kind === "text") {
                const content = (
                  <MarkdownRenderer
                    content={group.part.text}
                    id={`${message.id}-text-${index}`}
                    isStreaming={isStreaming}
                    key={group.key}
                  />
                );

                if (isAssistant) {
                  return content;
                }

                return (
                  <Bubble
                    align="end"
                    className="max-w-full"
                    key={group.key}
                    variant="muted"
                  >
                    <BubbleContent className="max-w-full">{content}</BubbleContent>
                  </Bubble>
                );
              }

              return (
                <AttachmentGroup
                  className="flex-wrap"
                  key={group.key}
                >
                  {group.parts.map((part) => {
                    const isImage = part.mediaType.startsWith("image/");

                    return (
                      <Attachment
                        className="min-w-0"
                        key={part.url}
                        orientation={isImage ? "vertical" : "horizontal"}
                        size="sm"
                      >
                        <AttachmentMedia variant={isImage ? "image" : "icon"}>
                          {isImage ? (
                            <Image
                              alt={part.filename ?? t("attachment_fallback")}
                              height={160}
                              src={part.url}
                              width={160}
                            />
                          ) : (
                            <FileText />
                          )}
                        </AttachmentMedia>
                        {!isImage && (
                          <AttachmentContent>
                            <AttachmentTitle>
                              {part.filename ?? t("document_fallback")}
                            </AttachmentTitle>
                          </AttachmentContent>
                        )}
                      </Attachment>
                    );
                  })}
                </AttachmentGroup>
              );
            })}
          </div>
        )}

        <MessageFooter className={cn("mt-1 px-0", !isAssistant && "justify-end")}>
          {fullText.trim() !== "" && (
            <>
              <CopyButton
                className="size-9 px-3"
                tooltipText={t("copy_response")}
                value={fullText}
              />
              <AppTooltip content={tCommon("retry")}>
                <AppButton
                  aria-label={tCommon("retry")}
                  className="opacity-0 duration-300 group-hover:opacity-100"
                  disabled={isStreaming}
                  onClick={onRegenerate}
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
              aria-label={tCommon("edit")}
              className="opacity-0 duration-300 group-hover:opacity-100"
              onClick={() => onEdit(fullText)}
              size="icon"
              variant="ghost"
            >
              <Pencil />
            </AppButton>
          )}
        </MessageFooter>
      </MessageContent>
    </Message>
  );
}
