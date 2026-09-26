"use client";

import type { LayoutStorage } from "react-resizable-panels";
import { useDefaultLayout } from "react-resizable-panels";

/**
 * `useDefaultLayout` reads storage synchronously while rendering, and its
 * `storage` option defaults to a bare `localStorage` reference — which throws
 * during server rendering. Every access is guarded instead.
 */
const storage: LayoutStorage = {
  getItem: (key) => (typeof window === "undefined" ? null : localStorage.getItem(key)),
  setItem: (key, value) => {
    if (typeof window !== "undefined") {
      localStorage.setItem(key, value);
    }
  },
};

/**
 * Persists a `ResizablePanelGroup` layout across reloads.
 */
export function usePanelLayout(groupId: string) {
  const { defaultLayout, onLayoutChanged } = useDefaultLayout({
    id: groupId,
    onlySaveAfterUserInteractions: true,
    storage,
  });

  return { defaultLayout, onLayoutChanged };
}
