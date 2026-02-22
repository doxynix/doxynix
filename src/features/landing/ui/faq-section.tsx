import { useTranslations } from "next-intl";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/shared/ui/core/accordion";

type Props = { a: string; q: string; value: string };

function AccordionListItem({ a, q, value }: Readonly<Props>) {
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
      a: t("section_faq_a1"),
      q: t("section_faq_q1"),
      value: "item-1",
    },
    {
      a: t("section_faq_a2"),
      q: t("section_faq_q2"),
      value: "item-2",
    },
    {
      a: t("section_faq_a3"),
      q: t("section_faq_q3"),
      value: "item-3",
    },
    {
      a: t("section_faq_a4"),
      q: t("section_faq_q4"),
      value: "item-4",
    },
    {
      a: t("section_faq_a5"),
      q: t("section_faq_q5"),
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
