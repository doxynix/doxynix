"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";

import { cn } from "@/shared/lib/cn";
import { useDebounce } from "@/shared/lib/hooks/use-debounce";
import { preprocessMermaidChart } from "@/shared/lib/mermaid-preprocess";
import { type MermaidConfig, renderMermaidChart } from "@/shared/lib/mermaid-render";

export interface MermaidProps {
  buildHref?: (path: string) => string;
  chart: string;
  className?: string;
  config?: MermaidConfig;
  debounceTime?: number;
  onError?: (error: string) => void;
  // Native DOM MouseEvent: the handler is registered via figure.addEventListener, not a React synthetic event.
  onLinkClick?: (href: string, e: globalThis.MouseEvent) => void;
  onSuccess?: (svg: string) => void;
}

function useMermaid({
  buildHref,
  chart,
  config,
  debounceTime = 300,
  fallbackError,
}: {
  buildHref?: (path: string) => string;
  chart: string;
  config?: MermaidConfig;
  debounceTime?: number;
  fallbackError: string;
}) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const [svg, setSvg] = useState<null | string>(null);
  const [error, setError] = useState<null | string>(null);
  const [status, setStatus] = useState<"error" | "idle" | "loading" | "success">("idle");

  const configString = JSON.stringify({
    darkMode: isDark,
    theme: isDark ? ("charcoal" as const) : ("default" as const),
    ...config,
  });

  const id = useId().replaceAll(":", "");
  const renderRef = useRef<HTMLDivElement>(null);
  const debouncedChart = useDebounce(chart, debounceTime);

  const preprocessedChart = preprocessMermaidChart(debouncedChart, buildHref);

  const isChartEmpty = debouncedChart.trim() === "";
  const displayStatus = isChartEmpty ? "idle" : status;
  const displaySvg = isChartEmpty ? null : svg;
  const displayError = isChartEmpty ? null : error;

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
        if (isCancelled()) {
          return;
        }

        if (!renderRef.current) {
          return;
        }

        const svgOutput = await renderMermaidChart({
          chart: preprocessedChart,
          configString,
          id,
          target: renderRef.current,
        });

        if (!isCancelled()) {
          setSvg(svgOutput);
          setStatus("success");
        }
      } catch (error_) {
        if (!isCancelled()) {
          const message = error_ instanceof Error ? error_.message : fallbackError;
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
  }, [preprocessedChart, configString, id, debouncedChart, fallbackError]);

  return { error: displayError, renderRef, status: displayStatus, svg: displaySvg };
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
  const tCommon = useTranslations("Common");
  const { error, renderRef, status, svg } = useMermaid({
    buildHref,
    chart,
    config,
    debounceTime,
    fallbackError: tCommon("diagram_render_failed"),
  });

  useEffect(() => {
    if (status === "success" && svg) {
      onSuccess?.(svg);
    }
    if (status === "error" && error) {
      onError?.(error);
    }
  }, [status, svg, error, onSuccess, onError]);

  const figureRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const figure = figureRef.current;
    if (figure == null) {
      return;
    }
    const handleFigureClick = (event: globalThis.MouseEvent) => {
      const target = event.target as HTMLElement;
      const anchor = target.closest("a");
      if (!anchor) {
        return;
      }
      const href = anchor.getAttribute("href") ?? anchor.getAttribute("xlink:href");
      if (!href || !onLinkClick) {
        return;
      }
      event.preventDefault();
      const lowerHref = href.toLowerCase().trim();
      const isUnsafe =
        lowerHref.startsWith("javascript:") ||
        lowerHref.startsWith("data:") ||
        lowerHref.startsWith("vbscript:");
      if (!isUnsafe) {
        onLinkClick(href, event);
      }
    };
    figure.addEventListener("click", handleFigureClick);
    return () => figure.removeEventListener("click", handleFigureClick);
  }, [onLinkClick, svg]);

  return (
    <div className={cn("relative min-h-25 w-full", className)}>
      {status === "success" && svg && (
        <figure
          aria-label={tCommon("mermaid_diagram")}
          className="fade-in not-prose flex h-full w-full animate-in cursor-pointer items-center justify-center overflow-auto duration-300 [&_svg]:h-auto [&_svg]:max-w-full"
          dangerouslySetInnerHTML={{ __html: svg }}
          ref={figureRef}
        />
      )}

      <div
        aria-hidden="true"
        className="pointer-events-none invisible absolute inset-0 -z-50 h-full w-full overflow-hidden"
        ref={renderRef}
      />

      {status === "loading" && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/50 backdrop-blur-[1px]">
          <div className="flex flex-col items-center gap-3">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <span className="font-medium text-muted-foreground text-xs">
              {tCommon("rendering")}
            </span>
          </div>
        </div>
      )}

      {status === "error" && error && (
        <div className="flex w-full items-center justify-center rounded-lg border border-destructive/20 bg-destructive/5 p-6">
          <div className="flex max-w-md flex-col items-center gap-2 text-center">
            <span className="font-bold text-destructive text-xs uppercase tracking-wider">
              {tCommon("syntax_error")}
            </span>
            <code className="w-full break-all rounded bg-background/50 px-2 py-1 font-mono text-muted-foreground text-xs">
              {error.split("\n")[0]}
            </code>
          </div>
        </div>
      )}

      {status === "idle" && (
        <div className="flex h-full min-h-37.5 w-full items-center justify-center rounded-lg border-2 border-muted-foreground/20 border-dashed">
          <p className="text-muted-foreground text-sm">{tCommon("no_diagram_code")}</p>
        </div>
      )}
    </div>
  );
}
