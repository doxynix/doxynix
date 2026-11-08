"use client";

import { useQueryClient } from "@tanstack/react-query";
import type * as Ably from "ably";
import { useTranslations } from "next-intl";

import { useTRPC } from "@/shared/api/trpc";
import { useRouter } from "@/shared/i18n/navigation";

import { useRepoActions } from "@/entities/repo/model/use-repo-actions";

import { useNotificationActions } from "@/features/notifications/model/use-notification-actions";

export type RealtimeHandler = (message: Ably.Message) => void;

export type RealtimeHandlers = Record<string, RealtimeHandler>;

export function useRealtimeDeps() {
  const trpc = useTRPC();
  const router = useRouter();
  const t = useTranslations("Dashboard");
  const queryClient = useQueryClient();
  const { invalidateAll } = useNotificationActions();
  const { invalidate } = useRepoActions();

  return { invalidate, invalidateAll, queryClient, router, t, trpc };
}

export type RealtimeDeps = ReturnType<typeof useRealtimeDeps>;
