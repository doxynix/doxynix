import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

const getSnapshot = () =>
  typeof navigator !== "undefined" && /mac|iphone|ipad|ipod/i.test(navigator.userAgent);

const getServerSnapshot = () => false;

function useIsMac(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function useModifierKey(): string {
  return useIsMac() ? "⌘" : "Ctrl";
}
