import {
  type ComponentPropsWithoutRef,
  type ComponentRef,
  forwardRef,
  type HTMLAttributes,
} from "react";
import * as DrawerPrimitives from "@radix-ui/react-dialog";
import { RiCloseLine } from "@remixicon/react";

import { cx, focusRing } from "../../lib/utils";
import { Button } from "./button";

const Drawer = (props: ComponentPropsWithoutRef<typeof DrawerPrimitives.Root>) => {
  return <DrawerPrimitives.Root tremor-id="tremor-raw" {...props} />;
};
Drawer.displayName = "Drawer";

const DrawerTrigger = forwardRef<
  ComponentRef<typeof DrawerPrimitives.Trigger>,
  ComponentPropsWithoutRef<typeof DrawerPrimitives.Trigger>
>(({ className, ...props }, ref) => {
  return <DrawerPrimitives.Trigger className={cx(className)} ref={ref} {...props} />;
});
DrawerTrigger.displayName = "Drawer.Trigger";

const DrawerClose = forwardRef<
  ComponentRef<typeof DrawerPrimitives.Close>,
  ComponentPropsWithoutRef<typeof DrawerPrimitives.Close>
>(({ className, ...props }, ref) => {
  return <DrawerPrimitives.Close className={cx(className)} ref={ref} {...props} />;
});
DrawerClose.displayName = "Drawer.Close";

const DrawerPortal = DrawerPrimitives.Portal;

DrawerPortal.displayName = "DrawerPortal";

const DrawerOverlay = forwardRef<
  ComponentRef<typeof DrawerPrimitives.Overlay>,
  ComponentPropsWithoutRef<typeof DrawerPrimitives.Overlay>
>(({ className, ...props }, forwardedRef) => {
  return (
    <DrawerPrimitives.Overlay
      className={cx(
        // base
        "fixed inset-0 z-50 overflow-y-auto",
        // background color
        "bg-black/30",
        // transition
        "data-[state=closed]:animate-hide data-[state=open]:animate-dialog-overlay-show",
        className,
      )}
      ref={forwardedRef}
      {...props}
      style={{
        animationDuration: "400ms",
        animationFillMode: "backwards",
      }}
    />
  );
});

DrawerOverlay.displayName = "DrawerOverlay";

const DrawerContent = forwardRef<
  ComponentRef<typeof DrawerPrimitives.Content>,
  ComponentPropsWithoutRef<typeof DrawerPrimitives.Content>
>(({ className, ...props }, forwardedRef) => {
  return (
    <DrawerPortal>
      <DrawerOverlay>
        <DrawerPrimitives.Content
          className={cx(
            // base
            "fixed inset-y-2 z-50 mx-auto flex w-[95vw] flex-1 flex-col overflow-y-auto rounded-md border p-4 shadow-lg focus:outline-hidden max-sm:inset-x-2 sm:inset-y-2 sm:right-2 sm:max-w-lg sm:p-6",
            // border color
            "border-gray-200 dark:border-gray-900",
            // background color
            "bg-white dark:bg-[#090E1A]",
            // transition
            "data-[state=closed]:animate-drawer-slide-right-and-fade data-[state=open]:animate-drawer-slide-left-and-fade",
            focusRing,
            className,
          )}
          ref={forwardedRef}
          {...props}
        />
      </DrawerOverlay>
    </DrawerPortal>
  );
});

DrawerContent.displayName = "DrawerContent";

const DrawerHeader = forwardRef<HTMLDivElement, ComponentPropsWithoutRef<"div">>(
  ({ children, className, ...props }, ref) => {
    return (
      <div
        className="flex items-start justify-between gap-x-4 border-gray-200 border-b pb-4 dark:border-gray-900"
        ref={ref}
        {...props}
      >
        <div className={cx("mt-1 flex flex-col gap-y-1", className)}>{children}</div>
        <DrawerPrimitives.Close asChild>
          <Button
            className="aspect-square p-1 hover:bg-gray-100 dark:hover:bg-gray-400/10"
            variant="ghost"
          >
            <RiCloseLine aria-hidden="true" className="size-6" />
          </Button>
        </DrawerPrimitives.Close>
      </div>
    );
  },
);

DrawerHeader.displayName = "Drawer.Header";

const DrawerTitle = forwardRef<
  ComponentRef<typeof DrawerPrimitives.Title>,
  ComponentPropsWithoutRef<typeof DrawerPrimitives.Title>
>(({ className, ...props }, forwardedRef) => (
  <DrawerPrimitives.Title
    className={cx(
      // base
      "font-semibold text-base",
      // text color
      "text-gray-900 dark:text-gray-50",
      className,
    )}
    ref={forwardedRef}
    {...props}
  />
));

DrawerTitle.displayName = "DrawerTitle";

const DrawerBody = forwardRef<HTMLDivElement, ComponentPropsWithoutRef<"div">>(
  ({ className, ...props }, ref) => {
    return <div className={cx("flex-1 py-4", className)} ref={ref} {...props} />;
  },
);
DrawerBody.displayName = "Drawer.Body";

const DrawerDescription = forwardRef<
  ComponentRef<typeof DrawerPrimitives.Description>,
  ComponentPropsWithoutRef<typeof DrawerPrimitives.Description>
>(({ className, ...props }, forwardedRef) => {
  return (
    <DrawerPrimitives.Description
      className={cx("text-gray-500 dark:text-gray-500", className)}
      ref={forwardedRef}
      {...props}
    />
  );
});

DrawerDescription.displayName = "DrawerDescription";

const DrawerFooter = ({ className, ...props }: HTMLAttributes<HTMLDivElement>) => {
  return (
    <div
      className={cx(
        "flex flex-col-reverse border-gray-200 border-t pt-4 sm:flex-row sm:justify-end sm:space-x-2 dark:border-gray-900",
        className,
      )}
      {...props}
    />
  );
};

DrawerFooter.displayName = "DrawerFooter";

export {
  Drawer,
  DrawerBody,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
};
