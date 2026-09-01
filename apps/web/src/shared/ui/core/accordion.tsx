"use client";

import { type ComponentPropsWithoutRef, type ComponentRef, forwardRef } from "react";
import * as AccordionPrimitive from "@radix-ui/react-accordion";
import { ChevronDown } from "lucide-react";

import { cn } from "@/shared/lib/cn";

const Accordion = AccordionPrimitive.Root;

const AccordionItem = forwardRef<
  ComponentRef<typeof AccordionPrimitive.Item>,
  ComponentPropsWithoutRef<typeof AccordionPrimitive.Item>
>(({ className, ...props }, ref) => (
  <AccordionPrimitive.Item className={cn("border-b", className)} ref={ref} {...props} />
));
AccordionItem.displayName = "AccordionItem";

const AccordionTrigger = forwardRef<
  ComponentRef<typeof AccordionPrimitive.Trigger>,
  ComponentPropsWithoutRef<typeof AccordionPrimitive.Trigger>
>(({ children, className, ...props }, ref) => (
  <AccordionPrimitive.Header className="flex">
    <AccordionPrimitive.Trigger
      className={cn(
        "flex flex-1 items-center justify-between py-4 text-left font-medium text-sm transition-standard hover:underline [&[data-state=open]>svg]:rotate-180",
        "rounded-md focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring/50",
        className,
      )}
      ref={ref}
      {...props}
    >
      {children}
      <ChevronDown className="shrink-0 text-muted-foreground transition-standard transition-transform" />
    </AccordionPrimitive.Trigger>
  </AccordionPrimitive.Header>
));
AccordionTrigger.displayName = AccordionPrimitive.Trigger.displayName;

const AccordionContent = forwardRef<
  ComponentRef<typeof AccordionPrimitive.Content>,
  ComponentPropsWithoutRef<typeof AccordionPrimitive.Content>
>(({ children, className, ...props }, ref) => (
  <AccordionPrimitive.Content
    className="overflow-hidden text-sm data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down"
    ref={ref}
    {...props}
  >
    <div className={cn("pt-0 pb-4", className)}>{children}</div>
  </AccordionPrimitive.Content>
));
AccordionContent.displayName = AccordionPrimitive.Content.displayName;

export { Accordion, AccordionContent, AccordionItem, AccordionTrigger };
