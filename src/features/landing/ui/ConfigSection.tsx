import { highlightCode } from "@/shared/lib/shiki";

import { CodeWindow } from "./CodeWindow";

const CONFIG_CODE = `{
  "project": "my-awesome-saas",
  "entry": ["src/**/*.ts"],
  "exclude": ["**/*.spec.ts"],
  "output": {
    "modes": ["onboarding", "technical", "migration-guide"],
    "metrics": true,
    "format": "markdown",
    "path": "./docs"
  },
  "metrics": ["complexity", "bus-factor"]
}`;

export async function ConfigSection() {
  const html = await highlightCode(CONFIG_CODE, "json", "dark");

  return (
    <section className="relative z-10 container mx-auto px-4 py-24">
      <div className="grid grid-cols-1 items-center gap-12 md:grid-cols-2">
        <div>
          <h2 className="mb-6 text-3xl font-bold md:text-5xl">
            Configured in <span className="text-muted-foreground">JSON</span>,<br />
            executed in cloud.
          </h2>
          <p className="text-muted-foreground mb-8 text-lg">
            Drop a simple config file in your root. We handle parsing, token limits, and prompt
            engineering automatically.
          </p>
          <ul className="marker:bg-foreground marker:text-foreground flex list-disc flex-col gap-4 pl-5">
            <li>Auto-detects frameworks (Next.js, Nest)</li>
            <li>Ignores tests & build artifacts</li>
            <li>Custom output templates</li>
          </ul>
        </div>

        <CodeWindow title="doxynix.json" code={CONFIG_CODE} codeHtml={html} />
      </div>
    </section>
  );
}
