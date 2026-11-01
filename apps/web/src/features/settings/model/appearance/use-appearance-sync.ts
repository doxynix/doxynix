"use client";

import { useEffect, useRef } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useTheme } from "next-themes";

import { useTRPC } from "@/shared/api/trpc";
import { type AppearancePreferences, isThemeMode } from "@/shared/lib/appearance-preferences";
import {
  replaceAppearancePreferences,
  useAppearancePreferences,
} from "@/shared/lib/hooks/use-appearance-preferences";

const PUSH_DEBOUNCE_MS = 400;

export function useAppearanceSync() {
  const trpc = useTRPC();
  const { preferences, update } = useAppearancePreferences();
  const { setTheme, theme } = useTheme();

  const { data, isSuccess } = useQuery(trpc.user.getAppearance.queryOptions({}));
  const { mutate } = useMutation(trpc.user.updateAppearance.mutationOptions());

  const hydrated = useRef(false);
  const lastSynced = useRef<AppearancePreferences | null>(null);

  useEffect(() => {
    if (hydrated.current || !isSuccess) {
      return;
    }

    hydrated.current = true;

    if (data == null) {
      lastSynced.current = preferences;
      mutate(preferences);

      return;
    }

    lastSynced.current = data;
    replaceAppearancePreferences(data);
    setTheme(data.mode);
  }, [data, isSuccess, mutate, preferences, setTheme]);

  useEffect(() => {
    if (!hydrated.current || preferences === lastSynced.current) {
      return;
    }

    const timer = setTimeout(() => {
      lastSynced.current = preferences;
      mutate(preferences);
    }, PUSH_DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
    };
  }, [mutate, preferences]);

  useEffect(() => {
    if (!hydrated.current || !isThemeMode(theme) || theme === preferences.mode) {
      return;
    }

    update({ mode: theme });
  }, [preferences.mode, theme, update]);
}
