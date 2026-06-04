"use client";

import { groupBy } from "es-toolkit";
import { ChevronDown, Folder, MessageSquare, Plus } from "lucide-react";

import { cn } from "@/shared/lib/cn";
import { AppButton } from "@/shared/ui/core/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/shared/ui/core/collapsible";
import { ScrollArea } from "@/shared/ui/core/scroll-area";
import { Skeleton } from "@/shared/ui/core/skeleton";

type Props = {
  onNewChat: () => void;
  sessionId: null | string;
  sessions?: any[];
  setSessionId: (id: null | string) => void;
};

export function AgentSidebar({ onNewChat, sessionId, sessions, setSessionId }: Readonly<Props>) {
  if (!sessions) {
    return (
      <>
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-6 w-full" />
        ))}
      </>
    );
  }

  const globalSessions = sessions.filter((session) => session.repo == null);
  const repoSessionsOnly = sessions.filter((session) => session.repo != null);

  const repos = groupBy(
    repoSessionsOnly,
    (session) => `${session.repo.owner}/${session.repo.name}`
  );

  return (
    <div className="animate-in fade-in flex h-full flex-col">
      <div className="bg-card flex h-12 items-center justify-between border-b px-4 py-6">
        <h3 className="text-muted-foreground text-xs font-bold">History</h3>
        <AppButton size="icon" variant="ghost" onClick={onNewChat} className="size-6">
          <Plus />
        </AppButton>
      </div>

      <ScrollArea className="flex-1 px-3 py-3">
        <div className="flex flex-col gap-2">
          {Object.entries(repos).map(([repoKey, repoSessions]) => {
            const hasActiveSession = repoSessions.some((s: any) => s.id === sessionId);

            return (
              <Collapsible
                key={repoKey}
                defaultOpen={hasActiveSession}
                className="group/folder flex w-full flex-col gap-1"
              >
                <CollapsibleTrigger asChild>
                  <AppButton variant="ghost" className="justify-start text-left text-xs">
                    <div className="flex min-w-0 items-center gap-1">
                      <Folder className="text-muted-foreground" />
                      <span className="truncate">{repoKey}</span>
                    </div>
                    <ChevronDown className="text-muted-foreground group-data-[state=open]/folder:rotate-180" />
                  </AppButton>
                </CollapsibleTrigger>

                <CollapsibleContent className="ml-4 flex flex-col gap-1 border-l pl-2">
                  {repoSessions.map((session: any) => (
                    <AppButton
                      key={session.id}
                      variant="ghost"
                      onClick={() => setSessionId(session.id)}
                      className={cn(
                        "justify-start gap-1 truncate text-left text-xs",
                        sessionId === session.id ? "bg-accent text-foreground" : ""
                      )}
                    >
                      <MessageSquare className="text-muted-foreground" />
                      <span className="truncate">{session.title}</span>
                    </AppButton>
                  ))}
                </CollapsibleContent>
              </Collapsible>
            );
          })}

          {globalSessions.length > 0 && (
            <div className="mt-4 flex flex-col gap-1">
              <h4 className="mb-1 px-2 text-xs">Global Chats</h4>
              {globalSessions.map((session: any) => (
                <AppButton
                  key={session.id}
                  variant="ghost"
                  onClick={() => setSessionId(session.id)}
                  className={cn(
                    "justify-start gap-1 text-left text-xs",
                    sessionId === session.id ? "bg-accent text-foreground" : ""
                  )}
                >
                  <MessageSquare />
                  <span className="truncate">{session.title}</span>
                </AppButton>
              ))}
            </div>
          )}

          {sessions.length === 0 && (
            <p className="text-muted-foreground mt-8 text-center text-xs">No past chats yet</p>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
