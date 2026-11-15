import { useAppearancePreferences } from "./use-appearance-preferences";

export function useSingleKeyShortcuts(): boolean {
  return useAppearancePreferences().preferences.singleKeyShortcuts;
}
