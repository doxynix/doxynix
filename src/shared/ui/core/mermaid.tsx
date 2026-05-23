"use client";

import { useEffect, useId, useRef, useState, type MouseEvent } from "react";
import { useTheme } from "next-themes";
import { useDebounce } from "use-debounce";

import { cn } from "@/shared/lib/cn";
import { mermaidThemes, type MermaidCustomTheme } from "@/shared/lib/mermaid-themes";

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

export interface MermaidProps {
  buildHref?: (path: string) => string;
  chart: string;
  className?: string;
  config?: MermaidConfig;
  debounceTime?: number;
  onError?: (error: string) => void;
  onLinkClick?: (href: string, e: MouseEvent) => void;
  onSuccess?: (svg: string) => void;
}

function preprocessMermaidChart(chart: string, buildHref?: (path: string) => string): string {
  const lines = chart.split("\n");

  const firstLine =
    lines
      .find((line) => line.trim().length > 0)
      ?.trim()
      .toLowerCase() || "";

  const isFlowchart = firstLine.startsWith("graph") || firstLine.startsWith("flowchart");

  const clickLines: string[] = [];
  const processedLines: string[] = [];

  for (const line of lines) {
    const match = /\[\[([\w./-]+)]]/.exec(line);

    if (match != null) {
      const path = match[1];

      if (path == null) {
        processedLines.push(line);
        continue;
      }

      const cleanedLine = line.replace(`[[${path}]]`, path);
      processedLines.push(cleanedLine);

      if (isFlowchart) {
        const nodeMatch = /^\s*([\w-]+)/.exec(line);
        if (nodeMatch != null) {
          const nodeId = nodeMatch[1];

          if (nodeId == null) {
            continue;
          }

          const href =
            buildHref != null ? buildHref(path) : `/code?node=file:${encodeURIComponent(path)}`;
          clickLines.push(`  click ${nodeId} "${href}" "Explore ${path}"`);
        }
      }
    } else {
      processedLines.push(line);
    }
  }

  return [...processedLines, ...clickLines].join("\n");
}

function useMermaid({
  buildHref,
  chart,
  config,
  debounceTime = 300,
}: {
  buildHref?: (path: string) => string;
  chart: string;
  config?: MermaidConfig;
  debounceTime?: number;
}) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const [svg, setSvg] = useState<null | string>(null);
  const [error, setError] = useState<null | string>(null);
  const [status, setStatus] = useState<"error" | "idle" | "loading" | "success">("idle");

  const rawConfigString = JSON.stringify(config ?? {});
  const parsedRaw = JSON.parse(rawConfigString) as MermaidConfig;

  const configString = JSON.stringify({
    darkMode: isDark,
    theme: isDark ? ("charcoal" as const) : ("default" as const),
    ...parsedRaw,
  });

  const id = useId().replaceAll(":", "");
  const renderRef = useRef<HTMLDivElement>(null);
  const [debouncedChart] = useDebounce(chart, debounceTime);

  const preprocessedChart = preprocessMermaidChart(debouncedChart, buildHref);

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

    const controller = { cancelled: false };
    const isCancelled = () => controller.cancelled;

    const render = async () => {
      setStatus("loading");
      setError(null);

      try {
        const mermaidModule = await import("mermaid");
        const mermaid = mermaidModule.default;

        if (isCancelled()) return;

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
          flowchart: {
            htmlLabels: parsedConfig.flowchart?.htmlLabels ?? true,
            ...(parsedConfig.flowchart?.padding != null
              ? { padding: parsedConfig.flowchart.padding }
              : {}),
          },
          fontFamily: parsedConfig.fontFamily ?? "Inter, sans-serif",
          fontSize: parsedConfig.fontSize ?? 14,
          logLevel: parsedConfig.logLevel ?? "error",
          look: parsedConfig.look === "handDrawn" ? "handDrawn" : "classic",
          securityLevel: "loose",
          sequence: parsedConfig.sequence,
          startOnLoad: false,
          theme: resolvedMermaidTheme,
          themeVariables: resolvedThemeVars,
        });

        if (!renderRef.current) return;
        renderRef.current.innerHTML = "";

        const uniqueId = `mermaid-${id}-${Date.now()}`;

        const { svg: svgOutput } = await mermaid.render(
          uniqueId,
          preprocessedChart.trim(),
          renderRef.current
        );

        if (!isCancelled()) {
          setSvg(svgOutput);
          setStatus("success");
          renderRef.current.innerHTML = "";
        }
      } catch (error_) {
        if (!isCancelled()) {
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
      controller.cancelled = true;
    };
  }, [preprocessedChart, configString, id, debouncedChart]);

  return { error, renderRef, status, svg };
}

export function AppMermaid({
  buildHref,
  chart,
  className,
  config,
  debounceTime = 300,
  onError,
  onLinkClick,
  onSuccess,
}: Readonly<MermaidProps>) {
  const { error, renderRef, status, svg } = useMermaid({
    buildHref,
    chart,
    config,
    debounceTime,
  });

  useEffect(() => {
    if (status === "success" && svg) onSuccess?.(svg);
    if (status === "error" && error) onError?.(error);
  }, [status, svg, error, onSuccess, onError]);

  const handleSvgClick = (e: MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const anchor = target.closest("a");

    if (anchor) {
      const href = anchor.getAttribute("href") || anchor.getAttribute("xlink:href");
      if (href && onLinkClick) {
        onLinkClick(href, e);
      }
    }
  };

  return (
    <div className={cn("relative min-h-25 w-full", className)}>
      {status === "success" && svg && (
        /* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions */
        <figure
          dangerouslySetInnerHTML={{ __html: svg }}
          aria-label="Mermaid diagram"
          onClick={handleSvgClick}
          className="animate-in fade-in not-prose flex h-full w-full cursor-pointer items-center justify-center overflow-auto duration-300 [&_svg]:h-auto [&_svg]:max-w-full"
        />
      )}

      <div
        ref={renderRef}
        aria-hidden="true"
        className="pointer-events-none invisible absolute inset-0 -z-50 h-full w-full overflow-hidden"
      />

      {status === "loading" && (
        <div className="bg-background/50 absolute inset-0 flex items-center justify-center backdrop-blur-[1px]">
          <div className="flex flex-col items-center gap-3">
            <div className="border-primary h-5 w-5 animate-spin rounded-full border-2 border-t-transparent" />
            <span className="text-muted-foreground text-xs font-medium">Rendering...</span>
          </div>
        </div>
      )}

      {status === "error" && error && (
        <div className="border-destructive/20 bg-destructive/5 flex w-full items-center justify-center rounded-lg border p-6">
          <div className="flex max-w-md flex-col items-center gap-2 text-center">
            <span className="text-destructive text-xs font-bold tracking-wider uppercase">
              Syntax Error
            </span>
            <code className="text-muted-foreground bg-background/50 w-full rounded px-2 py-1 font-mono text-xs break-all">
              {error.split("\n")[0]}
            </code>
          </div>
        </div>
      )}

      {status === "idle" && (
        <div className="border-muted-foreground/20 flex h-full min-h-37.5 w-full items-center justify-center rounded-lg border-2 border-dashed">
          <p className="text-muted-foreground text-sm">No diagram code provided</p>
        </div>
      )}
    </div>
  );
}
