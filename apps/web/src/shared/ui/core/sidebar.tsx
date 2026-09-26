"use client";

import {
  type ComponentProps,
  type CSSProperties,
  createContext,
  type KeyboardEvent,
  type PointerEvent,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Menu, PanelLeft } from "lucide-react";
import { useTranslations } from "next-intl";

import { cn } from "@/shared/lib/cn";
import { setClientCookie } from "@/shared/lib/cookies";
import { useIsMobile } from "@/shared/lib/hooks/use-mobile";
import { useResizable } from "@/shared/lib/hooks/use-resizable";
import { AppButton } from "@/shared/ui/core/button";
import { Input } from "@/shared/ui/core/input";
import { Separator } from "@/shared/ui/core/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/shared/ui/core/sheet";
import { Skeleton } from "@/shared/ui/core/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/core/tooltip";

const SIDEBAR_COOKIE_NAME = "sidebar_state";
const SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // TIME: 1 year
const SIDEBAR_WIDTH_MOBILE = "18rem";
const SIDEBAR_WIDTH_ICON = "3rem";
// const SIDEBAR_KEYBOARD_SHORTCUT = "b";

const SIDEBAR_MIN_WIDTH = 200;
const SIDEBAR_MAX_WIDTH = 480;
const SIDEBAR_DEFAULT_WIDTH = 256;
const SIDEBAR_WIDTH_STORAGE_KEY = "app-sidebar-width";
const SIDEBAR_WIDTH_COOKIE_NAME = "sidebar_width";
/** How far a closed sidebar must be dragged before it reopens. */
const SIDEBAR_REOPEN_DRAG = 24;

type SidebarContextProps = {
  isMobile: boolean;
  isResizing: boolean;
  open: boolean;
  openMobile: boolean;
  /** Handlers for SidebarRail: resize while open, reopen while closed. */
  railProps: {
    onClick: () => void;
    onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
    onPointerDown: (event: PointerEvent<HTMLElement>) => void;
  };
  setOpen: (open: boolean) => void;
  setOpenMobile: (open: boolean) => void;
  state: "collapsed" | "expanded";
  toggleSidebar: () => void;
  width: number;
};

const SidebarContext = createContext<null | SidebarContextProps>(null);

function useSidebar() {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider.");
  }

  return context;
}

function SidebarProvider({
  children,
  className,
  defaultOpen = true,
  defaultWidth,
  onOpenChange: setOpenProp,
  open: openProp,
  style,
  ...props
}: ComponentProps<"div"> & {
  defaultOpen?: boolean;
  /** Width the server read from the cookie, so the first paint is already right. */
  defaultWidth?: number;
  onOpenChange?: (open: boolean) => void;
  open?: boolean;
}) {
  const isMobile = useIsMobile();
  const [openMobile, setOpenMobile] = useState(false);

  // This is the internal state of the sidebar.
  // We use openProp and setOpenProp for control from outside the component.
  const [_open, _setOpen] = useState(defaultOpen);
  const open = openProp ?? _open;

  const setOpen = (value: ((value: boolean) => boolean) | boolean) => {
    if (setOpenProp) {
      const openState = typeof value === "function" ? value(open) : value;
      setOpenProp(openState);
      return;
    }
    _setOpen((prev) => (typeof value === "function" ? value(prev) : value));
  };

  // This sets the cookie to keep the sidebar state.
  useEffect(() => {
    setClientCookie(SIDEBAR_COOKIE_NAME, open, SIDEBAR_COOKIE_MAX_AGE);
  }, [open]);

  // Helper to toggle the sidebar.
  const toggleSidebar = () => {
    return isMobile ? setOpenMobile((open) => !open) : setOpen((open) => !open);
  };

  // A drag is followed by a click; swallow that click so finishing a resize or a
  // reopen does not immediately toggle the sidebar back.
  const suppressClickRef = useRef(false);

  // One rail drives everything: drag to resize, drag to the edge to collapse,
  // and drag outwards from the closed state to reopen.
  const { handleProps, isResizing, setWidth, width } = useResizable({
    defaultWidth: SIDEBAR_DEFAULT_WIDTH,
    initialWidth: defaultWidth,
    maxWidth: SIDEBAR_MAX_WIDTH,
    minWidth: SIDEBAR_MIN_WIDTH,
    onDragEnd: (finalWidth, didMove) => {
      if (didMove) {
        suppressClickRef.current = true;
      }
      if (finalWidth <= SIDEBAR_MIN_WIDTH) {
        setOpen(false);
      }
    },
    side: "left",
    storageKey: SIDEBAR_WIDTH_STORAGE_KEY,
  });

  // Mirrored into a cookie so the next server render already knows the width and
  // the panel does not snap to it after hydration.
  useEffect(() => {
    if (isResizing) {
      return;
    }

    setClientCookie(SIDEBAR_WIDTH_COOKIE_NAME, String(width), SIDEBAR_COOKIE_MAX_AGE);
  }, [isResizing, width]);

  // Pointer x where a reopen drag started, or null when no such drag is active.
  const reopenFromRef = useRef<null | number>(null);

  // Latest refs so the reopen gesture keeps one stable set of window listeners.
  // Re-registering them mid-drag (which happens as soon as `open` flips) drops
  // the tail of the movement and leaves the panel at its minimum width.
  const gestureRef = useRef({ setOpen, setWidth });
  // No dep array on purpose: this is the useLatest pattern, so the gesture
  // handlers always see the current setters without re-subscribing listeners.
  useEffect(() => {
    gestureRef.current = { setOpen, setWidth };
  });

  useEffect(() => {
    const handlePointerMove = (event: globalThis.PointerEvent) => {
      const from = reopenFromRef.current;
      if (from === null || event.clientX - from < SIDEBAR_REOPEN_DRAG) {
        return;
      }

      suppressClickRef.current = true;
      gestureRef.current.setOpen(true);
      gestureRef.current.setWidth(event.clientX);
    };

    const stop = () => {
      reopenFromRef.current = null;
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
    };
  }, []);

  const railProps = {
    onClick: () => {
      if (suppressClickRef.current) {
        suppressClickRef.current = false;
        return;
      }

      toggleSidebar();
    },
    onKeyDown: handleProps.onKeyDown,
    onPointerDown: (event: PointerEvent<HTMLElement>) => {
      if (event.button !== 0) {
        return;
      }

      if (open) {
        handleProps.onPointerDown(event);
        return;
      }

      // Closed: the rail sits at the viewport edge, so horizontal travel is the
      // new width. Wait for real travel before committing to reopening.
      event.preventDefault();
      reopenFromRef.current = event.clientX;
    },
  };

  // Adds a keyboard shortcut to toggle the sidebar.
  // useEffect(() => {
  //   const handleKeyDown = (event: KeyboardEvent) => {
  //     if (event.key === SIDEBAR_KEYBOARD_SHORTCUT && (event.metaKey || event.ctrlKey)) {
  //       event.preventDefault();
  //       toggleSidebar();
  //     }
  //   };

  //   globalThis.addEventListener("keydown", handleKeyDown);
  //   return () => globalThis.removeEventListener("keydown", handleKeyDown);
  // }, [toggleSidebar]);

  // We add a state so that we can do data-state="expanded" or "collapsed".
  // This makes it easier to style the sidebar with Tailwind classes.
  const state = open ? "expanded" : "collapsed";

  const contextValue: SidebarContextProps = {
    isMobile,
    isResizing,
    open,
    openMobile,
    railProps,
    setOpen,
    setOpenMobile,
    state,
    toggleSidebar,
    width,
  };

  return (
    <SidebarContext.Provider value={contextValue}>
      <div
        className={cn(
          "group/sidebar-wrapper flex min-h-svh w-full has-data-[variant=inset]:bg-sidebar has-data-[variant=sidebar]:bg-background",
          className,
        )}
        data-resizing={isResizing || undefined}
        data-slot="sidebar-wrapper"
        style={
          {
            "--sidebar-width": `${width}px`,
            "--sidebar-width-icon": SIDEBAR_WIDTH_ICON,
            ...style,
          } as CSSProperties
        }
        {...props}
      >
        {children}
      </div>
    </SidebarContext.Provider>
  );
}

function Sidebar({
  children,
  className,
  collapsible = "offcanvas",
  side = "left",
  variant = "sidebar",
  ...props
}: ComponentProps<"div"> & {
  collapsible?: "icon" | "none" | "offcanvas";
  side?: "left" | "right";
  variant?: "floating" | "inset" | "sidebar";
}) {
  const tCommon = useTranslations("Common");
  const { isMobile, isResizing, openMobile, setOpenMobile, state } = useSidebar();

  if (collapsible === "none") {
    return (
      <div
        className={cn(
          "flex h-full w-(--sidebar-width) flex-col bg-sidebar text-sidebar-foreground",
          className,
        )}
        data-slot="sidebar"
        {...props}
      >
        {children}
      </div>
    );
  }

  if (isMobile) {
    return (
      <Sheet
        onOpenChange={setOpenMobile}
        open={openMobile}
        {...props}
      >
        <SheetContent
          className="w-(--sidebar-width) bg-sidebar p-0 text-sidebar-foreground [&>button]:hidden"
          data-mobile="true"
          data-sidebar="sidebar"
          data-slot="sidebar"
          side={side}
          style={
            {
              "--sidebar-width": SIDEBAR_WIDTH_MOBILE,
            } as CSSProperties
          }
        >
          <SheetHeader className="sr-only">
            <SheetTitle>{tCommon("menu")}</SheetTitle>
            <SheetDescription>{tCommon("sidebar_description")}</SheetDescription>
          </SheetHeader>
          <div className="flex h-full w-full flex-col">{children}</div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <div
      className="group peer hidden text-sidebar-foreground md:block"
      data-collapsible={state === "collapsed" ? collapsible : ""}
      data-resizing={isResizing || undefined}
      data-side={side}
      data-slot="sidebar"
      data-state={state}
      data-variant={variant}
    >
      {/* This is what handles the sidebar gap on desktop */}
      <div
        className={cn(
          "relative w-(--sidebar-width) bg-transparent transition-[width] duration-300 ease-out-expo",
          "group-data-[collapsible=offcanvas]:w-0",
          "group-data-[side=right]:rotate-180",
          "group-data-[resizing]:transition-none",
          variant === "floating" || variant === "inset"
            ? "group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)+(--spacing(4)))]"
            : "group-data-[collapsible=icon]:w-(--sidebar-width-icon)",
        )}
        data-slot="sidebar-gap"
      />
      <aside
        aria-label={tCommon("sidebar")}
        className={cn(
          "fixed inset-y-0 z-10 hidden h-svh w-(--sidebar-width) transition-[left,right,width] duration-300 ease-out-expo md:flex",
          "group-data-[resizing]:transition-none",
          side === "left"
            ? "left-0 group-data-[collapsible=offcanvas]:-left-(--sidebar-width)"
            : "right-0 group-data-[collapsible=offcanvas]:-right-(--sidebar-width)",
          // Adjust the padding for floating and inset variants.
          variant === "floating" || variant === "inset"
            ? "p-2 group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)+(--spacing(4))+2px)]"
            : "group-data-[collapsible=icon]:w-(--sidebar-width-icon) group-data-[side=left]:border-r group-data-[side=right]:border-l",
          className,
        )}
        data-slot="sidebar-container"
        {...props}
      >
        <div
          className="group-data-[variant=floating]:glass-panel flex h-full w-full flex-col bg-sidebar group-data-[variant=floating]:rounded-lg group-data-[variant=floating]:border group-data-[variant=floating]:border-sidebar-border group-data-[variant=floating]:shadow-sm"
          data-sidebar="sidebar"
          data-slot="sidebar-inner"
        >
          {children}
        </div>
      </aside>
    </div>
  );
}

function SidebarTrigger({ className, onClick, ...props }: ComponentProps<typeof AppButton>) {
  const tCommon = useTranslations("Common");
  const { toggleSidebar } = useSidebar();
  const isMobile = useIsMobile();

  return (
    <AppButton
      className={cn("size-7", className)}
      data-sidebar="trigger"
      data-slot="sidebar-trigger"
      onClick={(event) => {
        onClick?.(event);
        toggleSidebar();
      }}
      size="icon"
      variant="ghost"
      {...props}
    >
      {isMobile ? <Menu /> : <PanelLeft />}
      <span className="sr-only">{tCommon("toggle_sidebar")}</span>
    </AppButton>
  );
}

/**
 * The single sidebar affordance: drag to resize, drag to the minimum to
 * collapse, drag outwards from the closed state to reopen. A plain click (no
 * travel) still toggles.
 */
function SidebarRail({ className, ...props }: ComponentProps<"button">) {
  const tCommon = useTranslations("Common");
  const { railProps, state } = useSidebar();

  return (
    <button
      aria-label={tCommon("resize_sidebar")}
      className={cn(
        "z-20 hidden w-4 cursor-col-resize touch-none select-none transition-standard ease-out sm:flex",
        "after:absolute after:inset-y-0 after:left-1/2 after:w-0.5 hover:after:bg-sidebar-border",
        "focus-visible:after:bg-sidebar-border",
        // The negative offset straddles the boundary: half the grab area inside
        // the panel, half outside, with the hairline exactly on the edge. A
        // translate would push the hairline inboard instead.
        state === "expanded"
          ? // Absolute so the rail inherits the panel's vertical bounds and stops
            // below the app header, which is stacked above the whole sidebar.
            "absolute inset-y-0 -right-2"
          : // Offcanvas slides the panel off-screen, taking an absolute rail with
            // it, so a closed sidebar falls back to a viewport-anchored strip.
            "fixed inset-y-0 -left-2",
        className,
      )}
      data-sidebar="rail"
      data-slot="sidebar-rail"
      {...railProps}
      {...props}
    />
  );
}

function SidebarInset({ className, ...props }: ComponentProps<"main">) {
  return (
    <main
      className={cn(
        "relative flex w-full flex-1 flex-col bg-background",
        "md:peer-data-[variant=inset]:peer-data-[state=collapsed]:ml-2 md:peer-data-[variant=inset]:m-2 md:peer-data-[variant=inset]:ml-0 md:peer-data-[variant=inset]:rounded-xl md:peer-data-[variant=inset]:shadow-sm",
        className,
      )}
      data-slot="sidebar-inset"
      {...props}
    />
  );
}

function SidebarInput({ className, ...props }: ComponentProps<typeof Input>) {
  return (
    <Input
      className={cn("h-8 w-full bg-background shadow-none", className)}
      data-sidebar="input"
      data-slot="sidebar-input"
      {...props}
    />
  );
}

function SidebarHeader({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("flex flex-col gap-2 p-2", className)}
      data-sidebar="header"
      data-slot="sidebar-header"
      {...props}
    />
  );
}

function SidebarFooter({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("flex flex-col gap-2 p-2", className)}
      data-sidebar="footer"
      data-slot="sidebar-footer"
      {...props}
    />
  );
}

function SidebarSeparator({ className, ...props }: ComponentProps<typeof Separator>) {
  return (
    <Separator
      className={cn("mx-2 w-auto bg-sidebar-border", className)}
      data-sidebar="separator"
      data-slot="sidebar-separator"
      {...props}
    />
  );
}

function SidebarContent({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex min-h-0 min-w-0 flex-1 flex-col gap-2 overflow-auto group-data-[collapsible=icon]:overflow-hidden",
        className,
      )}
      data-sidebar="content"
      data-slot="sidebar-content"
      {...props}
    />
  );
}

function SidebarGroup({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("relative flex w-full min-w-0 flex-col p-2", className)}
      data-sidebar="group"
      data-slot="sidebar-group"
      {...props}
    />
  );
}

function SidebarGroupLabel({
  asChild = false,
  className,
  ...props
}: ComponentProps<"div"> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "div";

  return (
    <Comp
      className={cn(
        "flex h-8 shrink-0 items-center rounded-xl px-2 font-medium text-xs outline-hidden ring-sidebar-ring transition-[margin,opacity] duration-200 ease-out focus-visible:ring-2 [&>svg]:size-4 [&>svg]:shrink-0",
        "group-data-[collapsible=icon]:-mt-8 group-data-[collapsible=icon]:opacity-0",
        className,
      )}
      data-sidebar="group-label"
      data-slot="sidebar-group-label"
      {...props}
    />
  );
}

function SidebarGroupAction({
  asChild = false,
  className,
  ...props
}: ComponentProps<"button"> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      className={cn(
        "absolute top-3.5 right-3 flex aspect-square w-5 items-center justify-center rounded-xl border border-transparent p-0 text-sidebar-foreground outline-hidden ring-sidebar-ring transition-transform hover:bg-sidebar hover:text-sidebar-accent-foreground focus-visible:ring-2 [&>svg]:size-4 [&>svg]:shrink-0",
        // Increases the hit area of the button on mobile.
        "after:absolute after:-inset-2 md:after:hidden",
        "group-data-[collapsible=icon]:hidden",
        className,
      )}
      data-sidebar="group-action"
      data-slot="sidebar-group-action"
      {...props}
    />
  );
}

function SidebarGroupContent({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("w-full text-sm", className)}
      data-sidebar="group-content"
      data-slot="sidebar-group-content"
      {...props}
    />
  );
}

function SidebarMenu({ className, ...props }: ComponentProps<"ul">) {
  return (
    <ul
      className={cn("flex w-full min-w-0 flex-col gap-1", className)}
      data-sidebar="menu"
      data-slot="sidebar-menu"
      {...props}
    />
  );
}

function SidebarMenuItem({ className, ...props }: ComponentProps<"li">) {
  return (
    <li
      className={cn("group/menu-item relative", className)}
      data-sidebar="menu-item"
      data-slot="sidebar-menu-item"
      {...props}
    />
  );
}

const sidebarMenuButtonVariants = cva(
  "peer/menu-button flex w-full items-center gap-2 overflow-hidden rounded-xl border border-transparent p-2 text-left text-sm outline-hidden transition-colors disabled:pointer-events-none disabled:opacity-50",
  {
    defaultVariants: {
      size: "default",
      variant: "default",
    },
    variants: {
      size: {
        default: "h-8 text-sm",
        lg: "h-12 text-sm group-data-[collapsible=icon]:p-0!",
        sm: "h-7 text-xs",
      },
      variant: {
        default: [
          "hover:bg-sidebar hover:text-sidebar-accent-foreground",
          "focus-visible:ring-2 focus-visible:ring-sidebar-ring",
          "active:text-sidebar-accent-foreground",
          "data-[active=true]:bg-sidebar-accent data-[active=true]:font-medium data-[active=true]:text-sidebar-accent-foreground",
        ],
        outline: [
          "border-border bg-background",
          "hover:border-border-strong hover:bg-sidebar",
          "focus-visible:ring-2 focus-visible:ring-sidebar-ring",
          "active:bg-sidebar-accent",
        ],
      },
    },
  },
);

function SidebarMenuButton({
  asChild = false,
  className,
  isActive = false,
  size = "default",
  tooltip,
  variant = "default",
  ...props
}: ComponentProps<"button"> &
  VariantProps<typeof sidebarMenuButtonVariants> & {
    asChild?: boolean;
    isActive?: boolean;
    tooltip?: ComponentProps<typeof TooltipContent> | string;
  }) {
  const Comp = asChild ? Slot : "button";
  const { isMobile, state } = useSidebar();

  const button = (
    <Comp
      className={cn(sidebarMenuButtonVariants({ size, variant }), className)}
      data-active={isActive}
      data-sidebar="menu-button"
      data-size={size}
      data-slot="sidebar-menu-button"
      {...props}
    />
  );

  if (tooltip == null) {
    return button;
  }

  if (typeof tooltip === "string") {
    tooltip = {
      children: tooltip,
    };
  }

  return (
    <Tooltip
      delayDuration={300}
      disableHoverableContent
    >
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent
        align="center"
        className="hidden [@media(hover:hover)]:block"
        hidden={state !== "collapsed" || isMobile}
        side="right"
        {...tooltip}
      />
    </Tooltip>
  );
}

function SidebarMenuAction({
  asChild = false,
  className,
  showOnHover = false,
  ...props
}: ComponentProps<"button"> & {
  asChild?: boolean;
  showOnHover?: boolean;
}) {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      className={cn(
        "absolute top-1.5 right-1 flex aspect-square w-5 items-center justify-center rounded-xl border border-transparent p-0 text-sidebar-foreground outline-hidden ring-sidebar-ring transition-transform hover:bg-sidebar hover:text-sidebar-accent-foreground focus-visible:ring-2 peer-hover/menu-button:text-sidebar-accent-foreground [&>svg]:size-4 [&>svg]:shrink-0",
        // Increases the hit area of the button on mobile.
        "after:absolute after:-inset-2 md:after:hidden",
        "peer-data-[size=sm]/menu-button:top-1",
        "peer-data-[size=default]/menu-button:top-1.5",
        "peer-data-[size=lg]/menu-button:top-2.5",
        "group-data-[collapsible=icon]:hidden",
        showOnHover &&
          "group-focus-within/menu-item:opacity-100 group-hover/menu-item:opacity-100 data-[state=open]:opacity-100 peer-data-[active=true]/menu-button:text-sidebar-accent-foreground md:opacity-0",
        className,
      )}
      data-sidebar="menu-action"
      data-slot="sidebar-menu-action"
      {...props}
    />
  );
}

function SidebarMenuBadge({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "pointer-events-none right-1 flex h-5 min-w-5 select-none items-center justify-center rounded-xl px-1 font-medium text-sidebar-foreground text-xs tabular-nums",
        "peer-hover/menu-button:text-sidebar-accent-foreground peer-data-[active=true]/menu-button:text-sidebar-accent-foreground",
        "peer-data-[size=sm]/menu-button:top-1",
        "peer-data-[size=default]/menu-button:top-1.5",
        "peer-data-[size=lg]/menu-button:top-2.5",
        "group-data-[collapsible=icon]:hidden",
        className,
      )}
      data-sidebar="menu-badge"
      data-slot="sidebar-menu-badge"
      {...props}
    />
  );
}

function SidebarMenuSkeleton({
  className,
  showIcon = false,
  ...props
}: ComponentProps<"div"> & {
  showIcon?: boolean;
}) {
  return (
    <div
      className={cn("flex h-8 items-center gap-2 rounded-xl px-2", className)}
      data-sidebar="menu-skeleton"
      data-slot="sidebar-menu-skeleton"
      {...props}
    >
      {showIcon && (
        <Skeleton
          className="size-4 shrink-0 rounded-xl"
          data-sidebar="menu-skeleton-icon"
        />
      )}

      <Skeleton
        className="h-4 w-full flex-1"
        data-sidebar="menu-skeleton-text"
      />
    </div>
  );
}

function SidebarMenuSub({ className, ...props }: ComponentProps<"ul">) {
  return (
    <ul
      className={cn(
        "mx-3.5 flex min-w-0 translate-x-px flex-col gap-1 border-sidebar-border border-l px-2.5 py-0.5",
        "group-data-[collapsible=icon]:hidden",
        className,
      )}
      data-sidebar="menu-sub"
      data-slot="sidebar-menu-sub"
      {...props}
    />
  );
}

function SidebarMenuSubItem({ className, ...props }: ComponentProps<"li">) {
  return (
    <li
      className={cn("group/menu-sub-item relative", className)}
      data-sidebar="menu-sub-item"
      data-slot="sidebar-menu-sub-item"
      {...props}
    />
  );
}

function SidebarMenuSubButton({
  asChild = false,
  className,
  isActive = false,
  size = "md",
  ...props
}: ComponentProps<"a"> & {
  asChild?: boolean;
  isActive?: boolean;
  size?: "md" | "sm";
}) {
  const Comp = asChild ? Slot : "a";

  return (
    <Comp
      className={cn(
        "flex h-7 min-w-0 -translate-x-px items-center gap-2 overflow-hidden rounded-xl border border-transparent px-2 text-sidebar-foreground outline-hidden ring-sidebar-ring hover:bg-sidebar hover:text-sidebar-accent-foreground focus-visible:ring-2 active:bg-sidebar-accent active:text-sidebar-accent-foreground disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 [&>span:last-child]:truncate [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:text-sidebar-accent-foreground",
        "data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground",
        size === "sm" && "text-xs",
        size === "md" && "text-sm",
        "group-data-[collapsible=icon]:hidden",
        className,
      )}
      data-active={isActive}
      data-sidebar="menu-sub-button"
      data-size={size}
      data-slot="sidebar-menu-sub-button"
      {...props}
    />
  );
}

function SidebarMenuShortcut({ className, ...props }: ComponentProps<"kbd">) {
  return (
    <kbd
      className={cn("ml-auto text-muted-foreground text-xs tracking-widest", className)}
      data-slot="sidebar-menu-shortcut"
      {...props}
    />
  );
}

export {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInput,
  SidebarInset,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuShortcut,
  SidebarMenuSkeleton,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
  useSidebar,
};
