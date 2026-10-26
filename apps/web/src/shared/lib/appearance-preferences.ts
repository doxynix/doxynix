import * as z from "zod";

export const CODE_THEMES_DARK = [
  "andromeeda",
  "aurora-x",
  "ayu-dark",
  "ayu-mirage",
  "catppuccin-frappe",
  "catppuccin-macchiato",
  "catppuccin-mocha",
  "dark-plus",
  "dracula",
  "dracula-soft",
  "everforest-dark",
  "github-dark",
  "github-dark-default",
  "github-dark-dimmed",
  "github-dark-high-contrast",
  "gruvbox-dark-hard",
  "gruvbox-dark-medium",
  "gruvbox-dark-soft",
  "horizon",
  "houston",
  "kanagawa-dragon",
  "kanagawa-wave",
  "laserwave",
  "material-theme",
  "material-theme-darker",
  "material-theme-ocean",
  "material-theme-palenight",
  "min-dark",
  "monokai",
  "night-owl",
  "nord",
  "one-dark-pro",
  "plastic",
  "poimandres",
  "red",
  "rose-pine",
  "rose-pine-moon",
  "slack-dark",
  "solarized-dark",
  "synthwave-84",
  "tokyo-night",
  "vesper",
  "vitesse-black",
  "vitesse-dark",
] as const;

export const CODE_THEMES_LIGHT = [
  "ayu-light",
  "catppuccin-latte",
  "everforest-light",
  "github-light",
  "github-light-default",
  "github-light-high-contrast",
  "gruvbox-light-hard",
  "gruvbox-light-medium",
  "gruvbox-light-soft",
  "horizon-bright",
  "kanagawa-lotus",
  "light-plus",
  "material-theme-lighter",
  "min-light",
  "night-owl-light",
  "one-light",
  "rose-pine-dawn",
  "slack-ochin",
  "snazzy-light",
  "solarized-light",
  "vitesse-light",
] as const;

export const CODE_THEMES = ["auto", ...CODE_THEMES_DARK, ...CODE_THEMES_LIGHT] as const;
export type CodeTheme = (typeof CODE_THEMES)[number];

export const AUTO_CODE_THEMES = {
  dark: "github-dark-default",
  light: "github-light-default",
} as const;

export function codeThemeTone(theme: string): "light" | "dark" {
  return (CODE_THEMES_LIGHT as readonly string[]).includes(theme) ? "light" : "dark";
}

export const RADIUS_PRESETS = ["sharp", "default", "soft"] as const;
export type RadiusPreset = (typeof RADIUS_PRESETS)[number];

export const TEXT_SCALES = ["compact", "default", "large"] as const;
export type TextScale = (typeof TEXT_SCALES)[number];

export const THEMES = ["neutral", "violet", "ocean", "forest", "sunset", "mocha"] as const;
export type Theme = (typeof THEMES)[number];

export const THEME_MODES = ["light", "dark", "system"] as const;
export type ThemeMode = (typeof THEME_MODES)[number];

export function isThemeMode(value: unknown): value is ThemeMode {
  return typeof value === "string" && (THEME_MODES as readonly string[]).includes(value);
}

export type SidebarVariant = "sidebar" | "floating";

const FIELDS = {
  borderContrast: z.enum(["soft", "strong"]),
  codeTheme: z.enum(CODE_THEMES),
  collapsible: z.enum(["icon", "offcanvas"]),
  mode: z.enum(THEME_MODES),
  pointerCursor: z.boolean(),
  radius: z.enum(RADIUS_PRESETS),
  reduceMotion: z.boolean(),
  sidebarVariant: z.enum(["sidebar", "floating"]),
  textScale: z.enum(TEXT_SCALES),
  theme: z.enum(THEMES),
  underlineLinks: z.boolean(),
};

export const AppearanceInputSchema = z.object(FIELDS);
export const AppearancePatchSchema = AppearanceInputSchema.partial();

/** Permissive variant for stored data: an invalid field falls back without discarding the rest. */
export const AppearancePreferencesSchema = z.object({
  borderContrast: FIELDS.borderContrast.catch("soft"),
  codeTheme: FIELDS.codeTheme.catch("github-dark"),
  collapsible: FIELDS.collapsible.catch("offcanvas"),
  mode: FIELDS.mode.catch("system"),
  pointerCursor: FIELDS.pointerCursor.catch(true),
  radius: FIELDS.radius.catch("default"),
  reduceMotion: FIELDS.reduceMotion.catch(false),
  sidebarVariant: FIELDS.sidebarVariant.catch("sidebar"),
  textScale: FIELDS.textScale.catch("default"),
  theme: FIELDS.theme.catch("neutral"),
  underlineLinks: FIELDS.underlineLinks.catch(false),
});

export type AppearancePreferences = z.infer<typeof AppearancePreferencesSchema>;
export type AppearancePatch = z.infer<typeof AppearancePatchSchema>;

export const DEFAULT_APPEARANCE: AppearancePreferences = {
  borderContrast: "soft",
  codeTheme: "github-dark",
  collapsible: "offcanvas",
  mode: "system",
  pointerCursor: true,
  radius: "default",
  reduceMotion: false,
  sidebarVariant: "sidebar",
  textScale: "default",
  theme: "neutral",
  underlineLinks: false,
};

export const STORAGE_KEY = "doxynix-appearance";

const codeThemeListeners = new Set<() => void>();

export function publishCodeTheme(): void {
  for (const listener of codeThemeListeners) {
    listener();
  }
}

export function readAppearancePreferences(): AppearancePreferences {
  if (typeof window === "undefined") {
    return DEFAULT_APPEARANCE;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);

    return raw == null ? DEFAULT_APPEARANCE : AppearancePreferencesSchema.parse(JSON.parse(raw));
  } catch {
    return DEFAULT_APPEARANCE;
  }
}

export function writeAppearancePreferences(preferences: AppearancePreferences): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
  } catch {
    return;
  }

  publishCodeTheme();
}

const THEME_TRANSITION_MS = 320;

/** View Transitions API is not guaranteed by every TS DOM lib version yet. */
type ViewTransitionDocument = Document & {
  startViewTransition?: (callback: () => void) => unknown;
};

type ViewTransitionLike = {
  ready?: Promise<void>;
};

function startThemeTransition(root: HTMLElement): void {
  root.setAttribute("data-appearance-transition", "");
  window.setTimeout(() => {
    root.removeAttribute("data-appearance-transition");
  }, THEME_TRANSITION_MS);
}

export function withThemeTransition(apply: () => void): void {
  if (typeof document === "undefined") {
    apply();

    return;
  }

  const root = document.documentElement;
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (root.hasAttribute("data-reduce-motion") || prefersReducedMotion) {
    apply();

    return;
  }

  const viewTransition = (document as ViewTransitionDocument).startViewTransition;

  if (typeof viewTransition === "function") {
    try {
      const transition = viewTransition.call(document, () => {
        apply();
      }) as ViewTransitionLike | undefined;

      void transition?.ready
        ?.then(() => {
          document.documentElement.animate(
            [
              { opacity: 0, scale: 0.995 },
              { opacity: 1, scale: 1 },
            ],
            {
              duration: THEME_TRANSITION_MS,
              easing: "cubic-bezier(0.25, 0.8, 0.25, 1)",
              fill: "forwards",
              pseudoElement: "::view-transition-new(root)",
            },
          );
        })
        .catch(() => undefined);

      return;
    } catch {
      startThemeTransition(root);
      apply();

      return;
    }
  }

  startThemeTransition(root);
  apply();
}

export function applyAppearancePreferences(preferences: AppearancePreferences): void {
  if (typeof document === "undefined") {
    return;
  }

  const root = document.documentElement;

  root.removeAttribute("data-accent");
  root.setAttribute("data-radius", preferences.radius);
  root.setAttribute("data-text-scale", preferences.textScale);
  root.setAttribute("data-theme", preferences.theme);
  root.setAttribute("data-border-contrast", preferences.borderContrast);
  root.toggleAttribute("data-reduce-motion", preferences.reduceMotion);
  root.toggleAttribute("data-pointer-cursor", preferences.pointerCursor);
  root.toggleAttribute("data-underline-links", preferences.underlineLinks);
}

export function appearanceBootstrapScript(): string {
  const defaults = JSON.stringify(DEFAULT_APPEARANCE).replaceAll("<", "\\u003c");

  return `(function(){var d=${defaults},p={};try{var s=JSON.parse(localStorage.getItem("${STORAGE_KEY}")||"{}");if(s&&typeof s==="object")p=s}catch(e){}var v=Object.assign({},d,p);var r=document.documentElement;r.removeAttribute("data-accent");r.setAttribute("data-radius",v.radius);r.setAttribute("data-text-scale",v.textScale);r.setAttribute("data-theme",v.theme);r.setAttribute("data-border-contrast",v.borderContrast);r.toggleAttribute("data-reduce-motion",!!v.reduceMotion);r.toggleAttribute("data-pointer-cursor",!!v.pointerCursor);r.toggleAttribute("data-underline-links",!!v.underlineLinks)})();`;
}

export function subscribeCodeTheme(listener: () => void): () => void {
  codeThemeListeners.add(listener);

  return () => {
    codeThemeListeners.delete(listener);
  };
}

export function getCodeTheme(): CodeTheme {
  return readAppearancePreferences().codeTheme;
}
