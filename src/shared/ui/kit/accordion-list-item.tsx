import type { ReactNode } from "react";

import { AccordionContent, AccordionItem, AccordionTrigger } from "@/shared/ui/core/accordion";

type Props = {
  className?: string;
  content: ReactNode;
  trigger: ReactNode;
  value: string;
};

export function AccordionListItem({ className, content, trigger, value }: Readonly<Props>) {
  return (
    <AccordionItem value={value} className={className}>
      <AccordionTrigger className="text-left font-bold">{trigger}</AccordionTrigger>
      <AccordionContent>{content}</AccordionContent>
    </AccordionItem>
  );
}
