import { getTranslations } from "next-intl/server";

import { highlightCode } from "@/shared/lib/shiki";
import { CodeWindow } from "@/shared/ui/kit/code-window";

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
  const t = await getTranslations("Landing");
  const html = await highlightCode(CONFIG_CODE, "json", "dark");

  return (
    <section className="container mx-auto px-4 py-24">
      <div className="grid grid-cols-1 items-center gap-12 md:grid-cols-2">
        <div>
          <h2 className="mb-6 text-3xl font-bold not-md:text-center md:text-5xl">
            {t("section_config_title_prefix")}{" "}
            <span className="text-muted-foreground">{t("section_config_title_highlight")}</span>
            {t("section_config_title_suffix")}
            <br />
          </h2>
          <p className="text-muted-foreground mb-8 text-lg not-md:text-center">
            {t("section_config_desc")}
          </p>
          <ul className="marker:bg-foreground marker:text-foreground flex list-disc flex-col gap-4 pl-5">
            <li>{t("section_config_list_1")}</li>
            <li>{t("section_config_list_2")}</li>
            <li>{t("section_config_list_3")}</li>
          </ul>
        </div>

        <CodeWindow
          code={CONFIG_CODE}
          codeClassName="text-sm sm:text-base"
          codeHtml={html}
          title="doxynix.json"
        />
      </div>
    </section>
  );
}
