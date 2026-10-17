import { useSyncExternalStore } from "react";

const noopSubscribe = () => () => {};

export function useMounted() {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}
