import { useTranslations } from "next-intl";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/shared/ui/core/accordion";

type Props = { value: string; q: string; a: string };

function AccordionListItem({ value, q, a }: Props) {
  return (
    <AccordionItem value={value}>
      <AccordionTrigger>{q}</AccordionTrigger>
      <AccordionContent>{a}</AccordionContent>
    </AccordionItem>
  );
}

export function FAQSection() {
  const t = useTranslations("Landing");

  const FAQ: Props[] = [
    {
      q: t("section_faq_q1"),
      a: t("section_faq_a1"),
      value: "item-1",
    },
    {
      q: t("section_faq_q2"),
      a: t("section_faq_a2"),
      value: "item-2",
    },
    {
      q: t("section_faq_q3"),
      a: t("section_faq_a3"),
      value: "item-3",
    },
    {
      q: t("section_faq_q4"),
      a: t("section_faq_a4"),
      value: "item-4",
    },
    {
      q: t("section_faq_q5"),
      a: t("section_faq_a5"),
      value: "item-5",
    },
  ];

  return (
    <section className="container mx-auto max-w-3xl px-4 py-24">
      <h2 className="mb-12 text-center text-3xl font-bold md:text-5xl">FAQ</h2>
      <Accordion type="single" collapsible className="w-full">
        {FAQ.map((item) => (
          <AccordionListItem key={item.value} {...item} />
        ))}
      </Accordion>
    </section>
  );
}
