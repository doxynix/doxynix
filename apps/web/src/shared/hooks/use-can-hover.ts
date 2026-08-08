import { useSyncExternalStore } from "react";

export function useCanHover() {
  return useSyncExternalStore(
    (callback) => {
      const mql = window.matchMedia("(hover: hover)");
      mql.addEventListener("change", callback);
      return () => mql.removeEventListener("change", callback);
    },
    () => window.matchMedia("(hover: hover)").matches,
    () => true
  );
}
