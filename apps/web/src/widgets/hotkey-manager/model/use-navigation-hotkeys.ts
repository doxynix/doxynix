import { useHotkeys } from "react-hotkeys-hook";

import { GLOBAL_HOTKEY_SCOPE, SHORTCUT_ENTRIES, toHotkeySequence } from "@/shared/config/shortcuts";
import { useRouter } from "@/shared/i18n/navigation";
import { useSingleKeyShortcuts } from "@/shared/lib/hooks/use-single-key-shortcuts";

export type SequenceResult =
  | { action: "execute"; path: string }
  | { action: "reset" }
  | { action: "ignore" };

export function createNavigationRoutes(): Map<string, string> {
  const routes = new Map<string, string>();

  for (const entry of SHORTCUT_ENTRIES) {
    if (entry.group !== "navigation" || entry.href == null) {
      continue;
    }

    const sequence = toHotkeySequence(entry.keys);
    if (sequence == null) {
      continue;
    }

    routes.set(sequence, entry.href);
  }

  routes.set("g>o", "/dashboard");

  return routes;
}

const NAVIGATION_ROUTES = createNavigationRoutes();
const NAVIGATION_HOTKEYS = [...NAVIGATION_ROUTES.keys()].join(",");

export function resolveNavigationRoute(prefix: string, code: string): string | null {
  const secondKey = code.startsWith("Key") ? code.slice(3).toLowerCase() : null;

  if (secondKey == null) {
    return null;
  }

  return NAVIGATION_ROUTES.get(`${prefix}>${secondKey}`) ?? null;
}

export function processNavigationSequence(prefix: string | null, code: string): SequenceResult {
  if (prefix == null) {
    return { action: "ignore" };
  }

  const path = resolveNavigationRoute(prefix, code);
  if (path == null) {
    return { action: "reset" };
  }

  return { action: "execute", path };
}

export function useNavigationHotkeys(onAction?: () => void) {
  const router = useRouter();
  const singleKeyShortcuts = useSingleKeyShortcuts();

  useHotkeys(
    NAVIGATION_HOTKEYS,
    (_event, handler) => {
      const path = NAVIGATION_ROUTES.get(handler.hotkey);
      if (path == null) {
        return;
      }

      onAction?.();
      router.push(path);
    },
    {
      enabled: singleKeyShortcuts,
      enableOnFormTags: false,
      preventDefault: true,
      scopes: GLOBAL_HOTKEY_SCOPE,
      sequenceTimeoutMs: 1500,
    },
  );
}
