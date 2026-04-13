"use client";

import { useState } from "react";
import { useReactFlow } from "@xyflow/react";
import saveAs from "file-saver";
import { Download } from "lucide-react";
import type { Options } from "modern-screenshot";
import { useTheme } from "next-themes";

import { cn } from "@/shared/lib/cn";
import { LoadingButton } from "@/shared/ui/kit/loading-button";

type Props = {
  className?: string;
  filename?: string;
};

type ImageType = "png" | "webp";

export function ExportPanel({ className, filename = "repo-map" }: Readonly<Props>) {
  const { getNodes, getNodesBounds } = useReactFlow();
  const { resolvedTheme } = useTheme();
  const hasNodes = getNodes().length > 0;
  const [isExporting, setIsExporting] = useState<ImageType | null>(null);
  const disabled = !hasNodes || isExporting != null;

  const exportMap = async (format: ImageType) => {
    setIsExporting(format);

    try {
      const nodes = getNodes();
      const nodesBounds = getNodesBounds(nodes);
      const viewportElement = document.querySelector(".react-flow__viewport") as HTMLElement | null;

      if (viewportElement == null) {
        console.error("Viewport element not found");
        return;
      }

      const standardProps = Array.from(window.getComputedStyle(document.documentElement)).filter(
        (key) => !key.startsWith("--") && !key.startsWith("-webkit-") && !key.startsWith("-moz-")
      );

      const padding = 50;
      const width = nodesBounds.width + padding * 2;
      const height = nodesBounds.height + padding * 2;

      const options: Options = {
        backgroundColor: resolvedTheme === "dark" ? "#0a0a0a" : "#ffffff",
        features: {
          copyScrollbar: false,
          fixSvgXmlDecode: true,
          removeAbnormalAttributes: true,
          removeControlCharacter: true,
          restoreScrollPosition: false,
        },
        filter: (node: Node) => {
          if (node instanceof HTMLElement) {
            return !["react-flow__controls", "react-flow__minimap", "react-flow__panel"].some(
              (cls) => node.classList.contains(cls)
            );
          }
          return true;
        },
        height,
        includeStyleProperties: standardProps,
        quality: 0.9,

        scale: 2,

        style: {
          height: `${height}px`,
          transform: `translate(${-nodesBounds.x + padding}px, ${-nodesBounds.y + padding}px) scale(1)`,
          width: `${width}px`,
        },

        width,
      };

      const { domToBlob, domToWebp } = await import("modern-screenshot");

      if (format === "png") {
        const blob = await domToBlob(viewportElement, options);
        saveAs(blob, `${filename}.png`);
      } else {
        const blob = await domToWebp(viewportElement, options);
        saveAs(blob, `${filename}.webp`);
      }
    } catch (error) {
      console.error(`Failed to export:`, error);
    } finally {
      setIsExporting(null);
    }
  };

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <div className="text-muted-foreground flex items-center justify-center gap-1 text-xs">
        Export <Download className="size-3" />
      </div>
      <div className="rounded-xl border">
        <LoadingButton
          disabled={disabled}
          isLoading={isExporting === "png"}
          size="sm"
          variant="outline"
          onClick={() => void exportMap("png")}
          className="border-0 text-[10px]"
        >
          PNG
        </LoadingButton>

        <LoadingButton
          disabled={disabled}
          isLoading={isExporting === "webp"}
          size="sm"
          variant="outline"
          onClick={() => void exportMap("webp")}
          className="border-0 text-[10px]"
        >
          WEBP
        </LoadingButton>
      </div>
    </div>
  );
}
