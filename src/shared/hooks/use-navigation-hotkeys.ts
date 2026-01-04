import { useRouter } from "next/navigation";
import { useHotkeys } from "react-hotkeys-hook";

const NAV_MAP: Record<string, string> = {
  "alt+KeyO": "/dashboard",
  "alt+KeyR": "/repo",
  "alt+KeyS": "/settings",
  "alt+KeyP": "/settings?tab=profile",
  "alt+KeyB": "/settings?tab=billing",
  "alt+KeyA": "/settings?tab=api-keys",
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
        router.push(path);
      }
    },
    {
      enableOnFormTags: true,
      preventDefault: true,
    }
  );
}
