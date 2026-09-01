import { getTranslations } from "next-intl/server";

import { Accordion } from "@/shared/ui/core/accordion";
import { AccordionListItem } from "@/shared/ui/kit/accordion-list-item";

type Props = { a: string; q: string; value: string };

export async function FAQSection() {
  const t = await getTranslations("Landing");

  const items: Props[] = [1, 2, 3, 4, 5].map((i) => ({
    a: t(`section_faq_a${i}`),
    q: t(`section_faq_q${i}`),
    value: `item-${i}`,
  }));

  return (
    <section className="container mx-auto max-w-3xl px-4 py-24">
      <h2 className="mb-12 text-center font-bold text-3xl md:text-5xl">FAQ</h2>
      <Accordion className="w-full" collapsible type="single">
        {items.map((item) => (
          <AccordionListItem
            content={item.a}
            key={item.value}
            trigger={item.q}
            value={item.value}
          />
        ))}
      </Accordion>
    </section>
  );
}
