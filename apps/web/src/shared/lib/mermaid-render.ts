import { type MermaidCustomTheme, mermaidThemes } from "./mermaid-themes";

type MermaidBuiltinTheme = "base" | "dark" | "default" | "forest" | "neutral";
type MermaidTheme = MermaidBuiltinTheme | MermaidCustomTheme;

const BUILTIN_THEMES = new Set<string>(["base", "dark", "default", "forest", "neutral"]);

export interface MermaidConfig {
  darkMode?: boolean;
  flowchart?: {
    curve?: "cardinal" | "linear";
    htmlLabels?: boolean;
    padding?: number;
  };
  fontFamily?: string;
  fontSize?: number;
  logLevel?: "debug" | "error" | "fatal" | "info" | "trace" | "warn";
  look?: "classic" | "handDrawn" | "neo";
  sequence?: {
    actorMargin?: number;
    boxMargin?: number;
    diagramMarginX?: number;
    diagramMarginY?: number;
    height?: number;
    useMaxWidth?: boolean;
    width?: number;
  };
  theme?: MermaidTheme;
  themeVariables?: Record<string, string>;
}

// The dynamic import lives here rather than in the component: React Compiler cannot lower
// a dynamic import and bails out of the whole function that contains one.
export async function renderMermaidChart(options: {
  chart: string;
  configString: string;
  id: string;
  target: HTMLElement;
}): Promise<string> {
  const { chart, configString, id, target } = options;
  const mermaidModule = await import("mermaid");
  const mermaid = mermaidModule.default;

  const parsedConfig: MermaidConfig = JSON.parse(configString);

  const theme = parsedConfig.theme;
  const isCustomTheme = theme != null && !BUILTIN_THEMES.has(theme);
  const resolvedThemeVars = isCustomTheme
    ? {
        ...mermaidThemes[parsedConfig.theme as MermaidCustomTheme],
        ...parsedConfig.themeVariables,
      }
    : parsedConfig.themeVariables;

  const explicitTheme = theme as MermaidBuiltinTheme | undefined;
  const resolvedMermaidTheme = isCustomTheme
    ? "base"
    : (!explicitTheme || explicitTheme === "default") && parsedConfig.darkMode
      ? "dark"
      : (explicitTheme ?? "default");

  mermaid.initialize({
    htmlLabels: parsedConfig.flowchart?.htmlLabels ?? true,
    ...(parsedConfig.flowchart?.padding != null
      ? { flowchart: { padding: parsedConfig.flowchart.padding } }
      : {}),
    fontFamily: parsedConfig.fontFamily ?? "Inter, sans-serif",
    fontSize: parsedConfig.fontSize ?? 14,
    logLevel: parsedConfig.logLevel ?? "error",
    look: parsedConfig.look === "handDrawn" ? "handDrawn" : "classic",
    securityLevel: "strict",
    sequence: parsedConfig.sequence,
    startOnLoad: false,
    theme: resolvedMermaidTheme,
    themeVariables: resolvedThemeVars,
  });

  target.innerHTML = "";

  const { svg } = await mermaid.render(`mermaid-${id}-${Date.now()}`, chart.trim(), target);
  target.innerHTML = "";

  return svg;
}
