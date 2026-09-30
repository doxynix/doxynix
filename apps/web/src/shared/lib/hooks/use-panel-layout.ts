"use client";

import type { LayoutStorage } from "react-resizable-panels";
import { useDefaultLayout } from "react-resizable-panels";

// `useDefaultLayout` reads storage synchronously while rendering, and its default storage is a bare `localStorage` reference, which throws during SSR.
const storage: LayoutStorage = {
  getItem: (key) => (typeof window === "undefined" ? null : localStorage.getItem(key)),
  setItem: (key, value) => {
    if (typeof window !== "undefined") {
      localStorage.setItem(key, value);
    }
  },
};

export function usePanelLayout(groupId: string) {
  const { defaultLayout, onLayoutChanged } = useDefaultLayout({
    id: groupId,
    onlySaveAfterUserInteractions: true,
    storage,
  });

  return { defaultLayout, onLayoutChanged };
}
