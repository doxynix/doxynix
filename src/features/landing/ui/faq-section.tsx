import { useTranslations } from "next-intl";

import { Accordion } from "@/shared/ui/core/accordion";
import { AccordionListItem } from "@/shared/ui/kit/accordion-list-item";

type Props = { a: string; q: string; value: string };

export function FAQSection() {
  const t = useTranslations("Landing");

  const items: Props[] = [1, 2, 3, 4, 5].map((i) => ({
    a: t(`section_faq_a${i}`),
    q: t(`section_faq_q${i}`),
    value: `item-${i}`,
  }));

  return (
    <section className="container mx-auto max-w-3xl px-4 py-24">
      <h2 className="mb-12 text-center text-3xl font-bold md:text-5xl">FAQ</h2>
      <Accordion type="single" collapsible className="w-full">
        {items.map((item) => (
          <AccordionListItem
            key={item.value}
            value={item.value}
            content={item.a}
            trigger={item.q}
          />
        ))}
      </Accordion>
    </section>
  );
}
