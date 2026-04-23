"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

import { cn } from "@/shared/lib/cn";
import { mermaidThemes, type MermaidCustomTheme } from "@/shared/lib/mermaid-themes";

/* -------------------------------------------------------------------------------------------------
 * Types
 * -----------------------------------------------------------------------------------------------*/

export type MermaidBuiltinTheme = "base" | "dark" | "default" | "forest" | "neutral";
export type MermaidTheme = MermaidBuiltinTheme | MermaidCustomTheme;

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
  look?: "classic" | "handdrawn";
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

export interface MermaidProps {
  chart: string;
  className?: string;
  config?: MermaidConfig;
  /** Delay in ms before rendering triggers (useful for live editors) */
  debounceTime?: number;
  onError?: (error: string) => void;
  onSuccess?: (svg: string) => void;
}

/* -------------------------------------------------------------------------------------------------
 * Hook: useMermaid
 * Handles dynamic imports, configuration, and rendering logic.
 * -----------------------------------------------------------------------------------------------*/

function useMermaid({
  chart,
  config,
  debounceTime = 300,
}: {
  chart: string;
  config?: MermaidConfig;
  debounceTime?: number;
}) {
  const [svg, setSvg] = useState<null | string>(null);
  const [error, setError] = useState<null | string>(null);
  const [status, setStatus] = useState<"error" | "idle" | "loading" | "success">("idle");

  // Unique ID for this diagram instance
  const id = useId().replaceAll(":", "");

  // Hidden container for Mermaid's size calculations
  const renderRef = useRef<HTMLDivElement>(null);

  // Debounce the input chart string to avoid thrashing
  const debouncedChart = useDebounce(chart, debounceTime);

  // Memoize config to prevent deep object comparison issues in effects
  const configString = useMemo(() => JSON.stringify(config ?? {}), [config]);

  const [prevDebouncedChart, setPrevDebouncedChart] = useState(debouncedChart);

  if (debouncedChart !== prevDebouncedChart) {
    setPrevDebouncedChart(debouncedChart);

    if (!debouncedChart.trim()) {
      setStatus("idle");
      setSvg(null);
      setError(null);
    }
  }

  useEffect(() => {
    if (!debouncedChart.trim()) {
      return;
    }

    let isCancelled = false as boolean;

    const render = async () => {
      setStatus("loading");
      setError(null);

      try {
        // Dynamic import to keep bundle size small
        const mermaidModule = await import("mermaid");
        const mermaid = mermaidModule.default;

        if (isCancelled) return;

        const parsedConfig: MermaidConfig = JSON.parse(configString);

        // Resolve Theme
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

        // Initialize Mermaid
        // Note: startOnLoad must be false so we can manually render
        mermaid.initialize({
          flowchart: {
            htmlLabels: parsedConfig.flowchart?.htmlLabels ?? true,
            ...(parsedConfig.flowchart?.padding != null
              ? { padding: parsedConfig.flowchart.padding }
              : {}),
          },
          fontFamily: parsedConfig.fontFamily ?? "Inter, sans-serif",
          fontSize: parsedConfig.fontSize ?? 14,
          logLevel: parsedConfig.logLevel ?? "error",
          look: parsedConfig.look === "handdrawn" ? "handDrawn" : "classic",
          securityLevel: "loose",
          sequence: parsedConfig.sequence,
          startOnLoad: false,
          theme: resolvedMermaidTheme,
          themeVariables: resolvedThemeVars,
        });

        // Ensure we have a DOM node for calculation
        if (!renderRef.current) return;
        renderRef.current.innerHTML = "";

        // Generate unique ID for this specific render cycle
        const uniqueId = `mermaid-${id}-${Date.now()}`;

        // Render
        // We pass the ref as the container so Mermaid can calculate dimensions accurately
        const { svg: svgOutput } = await mermaid.render(
          uniqueId,
          debouncedChart.trim(),
          renderRef.current
        );

        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        if (!isCancelled) {
          setSvg(svgOutput);
          setStatus("success");
          // Clean up the calculation node to free memory
          renderRef.current.innerHTML = "";
        }
      } catch (error_) {
        if (!isCancelled) {
          const message = error_ instanceof Error ? error_.message : "Failed to render diagram";
          console.error("Mermaid Render Error:", error_);
          setError(message);
          setStatus("error");
          setSvg(null);
        }
      }
    };

    void render();

    return () => {
      isCancelled = true;
    };
  }, [debouncedChart, configString, id]);

  return { error, renderRef, status, svg };
}

/* -------------------------------------------------------------------------------------------------
 * Helper: useDebounce
 * -----------------------------------------------------------------------------------------------*/

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

/* -------------------------------------------------------------------------------------------------
 * Component: Mermaid
 * -----------------------------------------------------------------------------------------------*/

export function Mermaid({
  chart,
  className,
  config,
  debounceTime = 300,
  onError,
  onSuccess,
}: Readonly<MermaidProps>) {
  const { error, renderRef, status, svg } = useMermaid({
    chart,
    config,
    debounceTime,
  });

  // Propagate events to parent
  useEffect(() => {
    if (status === "success" && svg) onSuccess?.(svg);
    if (status === "error" && error) onError?.(error);
  }, [status, svg, error, onSuccess, onError]);

  return (
    <div className={cn("relative min-h-25 w-full", className)}>
      {/* 1. Visible Output Container */}
      {status === "success" && svg && (
        <figure
          dangerouslySetInnerHTML={{ __html: svg }}
          aria-label="Mermaid diagram"
          className="animate-in fade-in flex h-full w-full items-center justify-center overflow-auto duration-300 [&_svg]:h-auto [&_svg]:max-w-full"
        />
      )}

      {/* 2. Hidden Calculation Container
          Mermaid needs this to calculate layout dimensions before we show it.
      */}
      <div
        ref={renderRef}
        aria-hidden="true"
        className="pointer-events-none invisible absolute inset-0 -z-50 h-full w-full overflow-hidden"
      />

      {/* 3. Loading State */}
      {status === "loading" && (
        <div className="bg-background/50 absolute inset-0 flex items-center justify-center backdrop-blur-[1px]">
          <div className="flex flex-col items-center gap-3">
            <div className="border-primary h-5 w-5 animate-spin rounded-full border-2 border-t-transparent" />
            <span className="text-muted-foreground text-xs font-medium">Rendering...</span>
          </div>
        </div>
      )}

      {/* 4. Error State */}
      {status === "error" && error && (
        <div className="border-destructive/20 bg-destructive/5 flex w-full items-center justify-center rounded-lg border p-6">
          <div className="flex max-w-md flex-col items-center gap-2 text-center">
            <span className="text-destructive text-xs font-bold tracking-wider uppercase">
              Syntax Error
            </span>
            <code className="text-muted-foreground bg-background/50 w-full rounded px-2 py-1 font-mono text-xs break-all">
              {error.split("\n")[0]} {/* Show only first line of error for brevity */}
            </code>
          </div>
        </div>
      )}

      {/* 5. Idle State */}
      {status === "idle" && (
        <div className="border-muted-foreground/20 flex h-full min-h-37.5 w-full items-center justify-center rounded-lg border-2 border-dashed">
          <p className="text-muted-foreground text-sm">No diagram code provided</p>
        </div>
      )}
    </div>
  );
}
