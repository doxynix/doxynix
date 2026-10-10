"use client";

import type { ComponentProps, CSSProperties } from "react";
import * as SheetPrimitive from "@radix-ui/react-dialog";
import { XIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { cn } from "@/shared/lib/cn";
import { useResizable } from "@/shared/lib/hooks/use-resizable";

type SheetContentProps = ComponentProps<typeof SheetPrimitive.Content> & {
  resizable?: ResizableOptions;
  side?: "bottom" | "left" | "right" | "top";
};

type ResizableOptions = {
  defaultWidth?: number;
  maxWidth?: number;
  minWidth?: number;
  storageKey?: string;
};

function Sheet({ ...props }: Readonly<ComponentProps<typeof SheetPrimitive.Root>>) {
  return (
    <SheetPrimitive.Root
      data-slot="sheet"
      {...props}
    />
  );
}

function SheetTrigger({ ...props }: ComponentProps<typeof SheetPrimitive.Trigger>) {
  return (
    <SheetPrimitive.Trigger
      data-slot="sheet-trigger"
      {...props}
    />
  );
}

function SheetClose({ ...props }: ComponentProps<typeof SheetPrimitive.Close>) {
  return (
    <SheetPrimitive.Close
      data-slot="sheet-close"
      {...props}
    />
  );
}

function SheetPortal({ ...props }: Readonly<ComponentProps<typeof SheetPrimitive.Portal>>) {
  return (
    <SheetPrimitive.Portal
      data-slot="sheet-portal"
      {...props}
    />
  );
}

function SheetOverlay({ className, ...props }: ComponentProps<typeof SheetPrimitive.Overlay>) {
  return (
    <SheetPrimitive.Overlay
      className={cn(
        "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:duration-200 data-[state=open]:duration-200 fixed inset-0 z-50 bg-overlay/85 backdrop-blur-sm data-[state=closed]:animate-out data-[state=open]:animate-in",
        className,
      )}
      data-slot="sheet-overlay"
      {...props}
    />
  );
}

function SheetContent({
  children,
  className,
  resizable,
  side = "right",
  ...props
}: SheetContentProps) {
  const t = useTranslations("Common");

  const resizeSide = side === "left" || side === "right" ? side : null;
  const { handleProps, panelRef, width } = useResizable({
    cssVar: "--sheet-width",
    ...resizable,
    side: resizeSide ?? "right",
  });

  return (
    <SheetPortal>
      <SheetOverlay />
      <SheetPrimitive.Content
        className={cn(
          "fixed z-50 flex flex-col gap-4 bg-popover text-popover-foreground outline-hidden data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:duration-300 data-[state=open]:duration-400 data-[state=closed]:ease-in data-[state=open]:ease-out-expo",
          side === "right" &&
            "data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right inset-y-0 right-0 h-full w-3/4 border-l sm:max-w-sm",
          side === "left" &&
            "data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left inset-y-0 left-0 h-full w-3/4 border-r sm:max-w-sm",
          side === "top" &&
            "data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top inset-x-0 top-0 h-auto border-b",
          side === "bottom" &&
            "data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom inset-x-0 bottom-0 h-auto border-t",
          resizable != null && resizeSide !== null && "sm:w-(--sheet-width) sm:max-w-none",
          className,
        )}
        data-slot="sheet-content"
        ref={panelRef}
        style={resizable != null ? ({ "--sheet-width": `${width}px` } as CSSProperties) : undefined}
        {...props}
      >
        {children}
        {resizable != null && resizeSide !== null && (
          <div
            {...handleProps}
            aria-label={t("resize_sheet")}
            className={cn(
              "absolute inset-y-0 hidden w-3 cursor-col-resize touch-none select-none sm:block",
              "-left-1.5 after:absolute after:inset-y-0 after:left-1/2 after:w-0.5 after:-translate-x-1/2 hover:after:bg-border focus-visible:after:bg-ring",
              side === "left" && "-right-1.5 -left-auto after:left-auto after:right-1/2",
            )}
            data-slot="sheet-resize-handle"
          />
        )}
        <SheetPrimitive.Close className="absolute top-4 right-4 rounded-xl border border-transparent bg-transparent p-1 opacity-70 ring-offset-background transition-standard hover:border-border-strong hover:bg-surface-hover hover:opacity-100 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-secondary">
          <XIcon />
          <span className="sr-only">{t("close")}</span>
        </SheetPrimitive.Close>
      </SheetPrimitive.Content>
    </SheetPortal>
  );
}

function SheetHeader({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("flex flex-col gap-1.5 p-4", className)}
      data-slot="sheet-header"
      {...props}
    />
  );
}

function SheetFooter({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("mt-auto flex flex-col gap-2 p-4", className)}
      data-slot="sheet-footer"
      {...props}
    />
  );
}

function SheetTitle({ className, ...props }: ComponentProps<typeof SheetPrimitive.Title>) {
  return (
    <SheetPrimitive.Title
      className={cn("font-semibold text-foreground tracking-[-0.02em]", className)}
      data-slot="sheet-title"
      {...props}
    />
  );
}

function SheetDescription({
  className,
  ...props
}: ComponentProps<typeof SheetPrimitive.Description>) {
  return (
    <SheetPrimitive.Description
      className={cn("text-muted-foreground text-sm leading-6", className)}
      data-slot="sheet-description"
      {...props}
    />
  );
}

export {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
};
