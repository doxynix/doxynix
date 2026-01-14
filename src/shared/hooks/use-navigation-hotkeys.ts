import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useHotkeys } from "react-hotkeys-hook";

const NAV_MAP: Record<string, string> = {
  "alt+KeyO": "/dashboard",
  "alt+KeyR": "/dashboard/repo",
  "alt+KeyS": "/dashboard/settings/profile",
  "alt+KeyP": "/dashboard/settings/profile",
  "alt+KeyA": "/dashboard/settings/api-keys",
};

export function useNavigationHotkeys(onAction?: () => void) {
  const router = useRouter();

  const hotkeys = Object.keys(NAV_MAP).join(", ");

  return useHotkeys(
    hotkeys,
    (e) => {
      const fullKey = `${e.altKey ? "alt+" : ""}${e.code}`;
      const path = NAV_MAP[fullKey];

      if (path) {
        e.preventDefault();
        onAction?.();
        router.push(path as Route);
      }
    },
    {
      enableOnFormTags: true,
      preventDefault: true,
    }
  );
}
