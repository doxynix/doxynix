"use client";

import { groupBy } from "es-toolkit";
import { ChevronDown, Folder, MessageSquare, Plus } from "lucide-react";
import { useTranslations } from "next-intl";

import { cn } from "@/shared/lib/cn";
import { AppButton } from "@/shared/ui/core/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/shared/ui/core/collapsible";
import { ScrollArea } from "@/shared/ui/core/scroll-area";
import { Skeleton } from "@/shared/ui/core/skeleton";

import type { AgentSession } from "../model/agent-types";
import { DeleteChatDialog } from "./delete-chat-dialog";
import { RenameChatDialog } from "./rename-chat-dialog";

type Props = {
  onNewChat: () => void;
  onSessionDeleted?: (sessionId: string) => void;
  sessionId: null | string;
  sessions?: AgentSession[];
  setSessionId: (id: null | string) => void;
};

type SessionWithRepo = AgentSession & { repo: NonNullable<AgentSession["repo"]> };

const SKELETON_ROW_WIDTHS = [72, 88, 64, 80, 56];

function SessionsSkeleton() {
  return (
    <div className="flex flex-1 flex-col gap-2 px-3 py-3">
      {SKELETON_ROW_WIDTHS.map((width) => (
        <div
          className="flex h-9 items-center gap-1 px-4"
          key={width}
        >
          <Skeleton className="size-4 shrink-0 rounded-md" />
          <Skeleton
            className="h-4 rounded-lg"
            style={{ width: `calc(${width}% - 24px)` }}
          />
        </div>
      ))}
    </div>
  );
}

type ChatSessionRowProps = {
  isActive: boolean;
  onDeleted: (sessionId: string) => void;
  onSelect: (sessionId: string) => void;
  session: AgentSession;
};

function ChatSessionRow({ isActive, onDeleted, onSelect, session }: Readonly<ChatSessionRowProps>) {
  return (
    <div className="group/chat relative flex w-full min-w-0 items-center">
      <AppButton
        className={cn(
          "w-full min-w-0 max-w-full justify-start gap-1 pr-14 text-left text-xs group-hover/chat:bg-accent",
          isActive ? "bg-accent text-foreground" : "",
        )}
        onClick={() => onSelect(session.id)}
        variant="ghost"
      >
        <MessageSquare className="text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate text-left">{session.title}</span>
      </AppButton>
      <div className="absolute right-2 flex items-center opacity-0 transition-opacity gap-1 focus-within:opacity-100 group-hover/chat:opacity-100 not-md:opacity-100">
        <RenameChatDialog session={session} />
        <DeleteChatDialog
          onDeleted={onDeleted}
          session={session}
        />
      </div>
    </div>
  );
}

export function AgentSidebar({
  onNewChat,
  onSessionDeleted,
  sessionId,
  sessions,
  setSessionId,
}: Readonly<Props>) {
  const t = useTranslations("Agent");

  const globalSessions = sessions?.filter((session) => session.repo == null) ?? [];
  const repos = groupBy(
    sessions?.filter((session): session is SessionWithRepo => session.repo != null) ?? [],
    (session) => `${session.repo.owner}/${session.repo.name}`,
  );

  const handleDeleted = (deletedSessionId: string) => onSessionDeleted?.(deletedSessionId);

  return (
    <div className="fade-in flex h-full animate-in flex-col">
      <div className="flex h-12 items-center justify-between border-b bg-card px-4">
        <h2 className="font-bold text-muted-foreground text-xs">{t("history_title")}</h2>
        <AppButton
          aria-label={t("new_chat")}
          className="size-6"
          onClick={onNewChat}
          size="icon"
          variant="ghost"
        >
          <Plus />
        </AppButton>
      </div>

      {sessions == null ? (
        <SessionsSkeleton />
      ) : (
        <ScrollArea className="flex-1 px-3 py-3">
          <div className="flex flex-col gap-2">
            {Object.entries(repos).map(([repoKey, repoSessions]) => {
              const hasActiveSession = repoSessions.some((s) => s.id === sessionId);

              return (
                <Collapsible
                  className="group/folder flex w-full flex-col gap-1"
                  defaultOpen={hasActiveSession}
                  key={repoKey}
                >
                  <CollapsibleTrigger asChild>
                    <AppButton
                      className="justify-start text-left text-xs"
                      variant="ghost"
                    >
                      <div className="flex min-w-0 items-center gap-1">
                        <Folder className="text-muted-foreground" />
                        <span className="min-w-0 truncate">{repoKey}</span>
                      </div>
                      <ChevronDown className="text-muted-foreground group-data-[state=open]/folder:rotate-180" />
                    </AppButton>
                  </CollapsibleTrigger>

                  <CollapsibleContent className="ml-4 flex flex-col gap-1 border-l pl-2">
                    {repoSessions.map((session) => (
                      <ChatSessionRow
                        isActive={session.id === sessionId}
                        key={session.id}
                        onDeleted={handleDeleted}
                        onSelect={setSessionId}
                        session={session}
                      />
                    ))}
                  </CollapsibleContent>
                </Collapsible>
              );
            })}

            {globalSessions.length > 0 && (
              <div className="mt-4 flex flex-col gap-1">
                <h3 className="mb-1 px-2 text-xs">{t("global_chats")}</h3>
                {globalSessions.map((session) => (
                  <ChatSessionRow
                    isActive={session.id === sessionId}
                    key={session.id}
                    onDeleted={handleDeleted}
                    onSelect={setSessionId}
                    session={session}
                  />
                ))}
              </div>
            )}

            {sessions.length === 0 && (
              <p className="mt-8 text-center text-muted-foreground text-xs">{t("no_past_chats")}</p>
            )}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
