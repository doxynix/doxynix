import { AccordionContent, AccordionItem, AccordionTrigger } from "@/shared/ui/core/accordion";

type Props = {
  className?: string;
  content: React.ReactNode;
  trigger: React.ReactNode;
  value: string;
};

export function AccordionListItem({ className, content, trigger, value }: Readonly<Props>) {
  return (
    <AccordionItem value={value} className={className}>
      <AccordionTrigger className="text-left font-semibold">{trigger}</AccordionTrigger>
      <AccordionContent>{content}</AccordionContent>
    </AccordionItem>
  );
}
