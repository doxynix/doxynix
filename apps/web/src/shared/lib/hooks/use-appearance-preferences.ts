"use client";

import { useEffect, useSyncExternalStore } from "react";

import {
  type AppearancePreferences,
  applyAppearancePreferences,
  type CodeTheme,
  DEFAULT_APPEARANCE,
  getCodeTheme,
  publishCodeTheme,
  readAppearancePreferences,
  STORAGE_KEY,
  subscribeCodeTheme,
  withThemeTransition,
  writeAppearancePreferences,
} from "@/shared/lib/appearance-preferences";

import { useMounted } from "./use-mounted";

const listeners = new Set<() => void>();

let snapshot: AppearancePreferences | null = null;
let hydrated = false;

function getSnapshot(): AppearancePreferences {
  snapshot ??= readAppearancePreferences();

  return snapshot;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

function emit(): void {
  for (const listener of listeners) {
    listener();
  }
}

function updatePreferences(patch: Partial<AppearancePreferences>): void {
  const current = getSnapshot();
  const next = { ...current, ...patch };

  snapshot = next;

  if (next.theme === current.theme) {
    applyAppearancePreferences(next);
  } else {
    withThemeTransition(() => applyAppearancePreferences(next));
  }

  writeAppearancePreferences(next);
  emit();
}

export function replaceAppearancePreferences(next: AppearancePreferences): void {
  snapshot = next;
  applyAppearancePreferences(next);
  writeAppearancePreferences(next);
  emit();
}

export function useAppearancePreferences() {
  const preferences = useSyncExternalStore(subscribe, getSnapshot, () => DEFAULT_APPEARANCE);
  const ready = useMounted();

  useEffect(() => {
    if (hydrated) {
      return;
    }

    hydrated = true;
    applyAppearancePreferences(getSnapshot());
  }, []);

  useEffect(() => {
    function handleStorage(event: StorageEvent) {
      if (event.key !== STORAGE_KEY) {
        return;
      }

      snapshot = null;
      applyAppearancePreferences(getSnapshot());
      publishCodeTheme();
      emit();
    }

    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  return { preferences, ready, update: updatePreferences };
}

export function useCodeTheme(): CodeTheme {
  return useSyncExternalStore(subscribeCodeTheme, getCodeTheme, () => DEFAULT_APPEARANCE.codeTheme);
}
