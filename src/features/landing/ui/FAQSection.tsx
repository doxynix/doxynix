import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/shared/ui/accordion";

export function FAQSection() {
  return (
    <section className="relative z-10 container mx-auto max-w-3xl px-4 py-24">
      <h2 className="mb-12 text-center text-3xl font-bold md:text-5xl">FAQ</h2>
      <Accordion type="single" collapsible className="w-full">
        <AccordionItem value="item-1">
          <AccordionTrigger>Is my code safe?</AccordionTrigger>
          <AccordionContent>
            Absolutely. We use ephemeral containers for analysis. Your code is cloned, analyzed, and
            deleted immediately. We do not use your code to train our models (Zero Data Retention
            policy with OpenAI).
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="item-2">
          <AccordionTrigger>How accurate is the documentation?</AccordionTrigger>
          <AccordionContent>
            We use combined with AST (Abstract Syntax Tree) parsing. AST gives us 100% accurate
            structure (function names, params), while LLM explains the logic. This hybrid approach
            minimizes hallucinations.
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="item-3">
          <AccordionTrigger>Can I run this in CI/CD?</AccordionTrigger>
          <AccordionContent>
            Yes! We provide a GitHub Action and a CLI tool. You can set it to auto-update your
            `README.md` or `docs/` folder on every merge to main.
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="item-4">
          <AccordionTrigger>Does it work with legacy code?</AccordionTrigger>
          <AccordionContent>
            Legacy code is our specialty. Our &quot;Bus Factor&quot; analysis helps identify
            complex, undocumented parts of your system that need attention first.
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="item-5">
          <AccordionTrigger>What kind of metrics do you generate?</AccordionTrigger>
          <AccordionContent>
            We analyze Cyclomatic Complexity, Maintainability Index, and Bus Factor scores. These
            act as a health check for your repository, visualizing technical debt.
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </section>
  );
}
