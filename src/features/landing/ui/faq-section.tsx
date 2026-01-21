import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/shared/ui/core/accordion";

type Props = { value: string; q: string; a: string };

const FAQ: Props[] = [
  {
    q: "Is my code safe?",
    a: "Absolutely. We use ephemeral containers for analysis. Your code is cloned, analyzed, and deleted immediately. We do not use your code to train our models (Zero Data Retention policy with OpenAI).",
    value: "item-1",
  },
  {
    q: "How accurate is the documentation?",
    a: "We use combined with AST (Abstract Syntax Tree) parsing. AST gives us 100% accurate structure (function names, params), while LLM explains the logic. This hybrid approach minimizes hallucinations.",
    value: "item-2",
  },
  {
    q: "Can I run this in CI/CD?",
    a: "Yes! We provide a GitHub Action and a CLI tool. You can set it to auto-update your `README.md` or `docs/` folder on every merge to main.",
    value: "item-3",
  },
  {
    q: "Does it work with legacy code?",
    a: "Legacy code is our specialty. Our &quot;Bus Factor&quot; analysis helps identify complex, undocumented parts of your system that need attention first.",
    value: "item-4",
  },
  {
    q: "What kind of metrics do you generate?",
    a: "We analyze Cyclomatic Complexity, Maintainability Index, and Bus Factor scores. These act as a health check for your repository, visualizing technical debt.",
    value: "item-5",
  },
] as const;

function AccordionListItem({ value, q, a }: Props) {
  return (
    <AccordionItem value={value}>
      <AccordionTrigger>{q}</AccordionTrigger>
      <AccordionContent>{a}</AccordionContent>
    </AccordionItem>
  );
}

export function FAQSection() {
  return (
    <section className="relative z-10 container mx-auto max-w-3xl px-4 py-24">
      <h2 className="mb-12 text-center text-3xl font-bold md:text-5xl">FAQ</h2>
      <Accordion type="single" collapsible className="w-full">
        {FAQ.map((item) => (
          <AccordionListItem key={item.value} {...item} />
        ))}
      </Accordion>
    </section>
  );
}
