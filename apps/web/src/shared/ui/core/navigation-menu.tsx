import type { ComponentProps } from "react";
import * as NavigationMenuPrimitive from "@radix-ui/react-navigation-menu";
import { cva } from "class-variance-authority";
import { ChevronDownIcon } from "lucide-react";

import { cn } from "@/shared/lib/cn";

function NavigationMenu({
  children,
  className,
  viewport = true,
  ...props
}: ComponentProps<typeof NavigationMenuPrimitive.Root> & {
  viewport?: boolean;
}) {
  return (
    <NavigationMenuPrimitive.Root
      className={cn(
        "group/navigation-menu relative flex max-w-max flex-1 items-center justify-center",
        className,
      )}
      data-slot="navigation-menu"
      data-viewport={viewport}
      {...props}
    >
      {children}
      {viewport && <NavigationMenuViewport />}
    </NavigationMenuPrimitive.Root>
  );
}

function NavigationMenuList({
  className,
  ...props
}: ComponentProps<typeof NavigationMenuPrimitive.List>) {
  return (
    <NavigationMenuPrimitive.List
      className={cn("group flex flex-1 list-none items-center justify-center gap-1", className)}
      data-slot="navigation-menu-list"
      {...props}
    />
  );
}

function NavigationMenuItem({
  className,
  ...props
}: ComponentProps<typeof NavigationMenuPrimitive.Item>) {
  return (
    <NavigationMenuPrimitive.Item
      className={cn("relative", className)}
      data-slot="navigation-menu-item"
      {...props}
    />
  );
}

const navigationMenuTriggerStyle = cva(
  "group inline-flex h-9 w-max items-center justify-center rounded-xl border border-transparent bg-background px-4 py-2 font-medium text-sm tracking-[-0.02em] shadow-sm outline-hidden transition-standard hover:border-border-accent hover:bg-accent hover:text-accent-foreground focus:border-border-accent focus:bg-accent focus:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 data-[state=open]:border-border-accent data-[state=open]:bg-accent data-[state=open]:text-accent-foreground data-[state=open]:focus:bg-accent data-[state=open]:hover:bg-accent hover:[box-shadow:var(--shadow-sm)]",
);

function NavigationMenuTrigger({
  children,
  className,
  ...props
}: ComponentProps<typeof NavigationMenuPrimitive.Trigger>) {
  return (
    <NavigationMenuPrimitive.Trigger
      className={cn(navigationMenuTriggerStyle(), "group", className)}
      data-slot="navigation-menu-trigger"
      {...props}
    >
      {children}{" "}
      <ChevronDownIcon className="relative top-px ml-1 size-3 transition-standard group-data-[state=open]:rotate-180" />
    </NavigationMenuPrimitive.Trigger>
  );
}

function NavigationMenuContent({
  className,
  ...props
}: ComponentProps<typeof NavigationMenuPrimitive.Content>) {
  return (
    <NavigationMenuPrimitive.Content
      className={cn(
        "data-[motion^=from-]:fade-in data-[motion^=to-]:fade-out data-[motion=from-end]:slide-in-from-right-52 data-[motion=from-start]:slide-in-from-left-52 data-[motion=to-end]:slide-out-to-right-52 data-[motion=to-start]:slide-out-to-left-52 top-0 left-0 w-full p-2 pr-2.5 data-[motion^=from-]:animate-in data-[motion^=to-]:animate-out md:absolute md:w-auto",
        "group-data-[viewport=false]/navigation-menu:glass-panel group-data-[viewport=false]/navigation-menu:data-[state=closed]:zoom-out-95 group-data-[viewport=false]/navigation-menu:data-[state=open]:zoom-in-95 group-data-[viewport=false]/navigation-menu:data-[state=open]:fade-in-0 group-data-[viewport=false]/navigation-menu:data-[state=closed]:fade-out-0 group-data-[viewport=false]/navigation-menu:top-full group-data-[viewport=false]/navigation-menu:mt-1.5 group-data-[viewport=false]/navigation-menu:overflow-hidden group-data-[viewport=false]/navigation-menu:rounded-xl group-data-[viewport=false]/navigation-menu:border group-data-[viewport=false]/navigation-menu:bg-popover group-data-[viewport=false]/navigation-menu:text-popover-foreground group-data-[viewport=false]/navigation-menu:shadow-md group-data-[viewport=false]/navigation-menu:transition-standard group-data-[viewport=false]/navigation-menu:data-[state=closed]:animate-out group-data-[viewport=false]/navigation-menu:data-[state=open]:animate-in",
        className,
      )}
      data-slot="navigation-menu-content"
      {...props}
    />
  );
}

function NavigationMenuViewport({
  className,
  ...props
}: ComponentProps<typeof NavigationMenuPrimitive.Viewport>) {
  return (
    <div className={cn("absolute top-full left-0 isolate z-50 flex justify-center")}>
      <NavigationMenuPrimitive.Viewport
        className={cn(
          "glass-panel data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-90 relative mt-1.5 h-(--radix-navigation-menu-viewport-height) w-full origin-top overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-md transition-standard data-[state=closed]:animate-out data-[state=open]:animate-in md:w-(--radix-navigation-menu-viewport-width)",
          className,
        )}
        data-slot="navigation-menu-viewport"
        {...props}
      />
    </div>
  );
}

function NavigationMenuLink({
  className,
  ...props
}: ComponentProps<typeof NavigationMenuPrimitive.Link>) {
  return (
    <NavigationMenuPrimitive.Link
      className={cn(
        "flex flex-col gap-1 rounded-xl border border-transparent p-2 text-sm outline-hidden transition-standard hover:border-border-accent hover:bg-accent hover:text-accent-foreground focus:border-border-accent focus:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring/50 data-[active=true]:border-border-accent data-[active=true]:bg-accent data-[active=true]:text-accent-foreground data-[active=true]:focus:bg-accent data-[active=true]:hover:bg-accent [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-muted-foreground",
        className,
      )}
      data-slot="navigation-menu-link"
      {...props}
    />
  );
}

function NavigationMenuIndicator({
  className,
  ...props
}: ComponentProps<typeof NavigationMenuPrimitive.Indicator>) {
  return (
    <NavigationMenuPrimitive.Indicator
      className={cn(
        "data-[state=hidden]:fade-out data-[state=visible]:fade-in top-full z-1 flex h-1.5 items-end justify-center overflow-hidden data-[state=hidden]:animate-out data-[state=visible]:animate-in",
        className,
      )}
      data-slot="navigation-menu-indicator"
      {...props}
    >
      <div className="relative top-[60%] size-2 rotate-45 rounded-tl-sm bg-border shadow-sm" />
    </NavigationMenuPrimitive.Indicator>
  );
}

export {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuIndicator,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  NavigationMenuViewport,
  navigationMenuTriggerStyle,
};
