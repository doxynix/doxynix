import { CodeWindow } from "./code-window";

type Props = {
  beforeHtmlDark: string;
  beforeHtmlLight: string;
  afterHtmlDark: string;
  afterHtmlLight: string;
  filename: string;
  badCode: string;
  goodCode: string;
};

export function CodeComparison({
  beforeHtmlDark,
  beforeHtmlLight,
  afterHtmlDark,
  afterHtmlLight,
  filename,
  badCode,
  goodCode,
}: Props) {
  const currentTheme = "dark"; // THEME: если вернется светлая тема сменить на хук useTheme и поставить вначале файла "use client"
  const isDark = currentTheme === "dark";

  const beforeHtml = isDark ? beforeHtmlDark : beforeHtmlLight;
  const afterHtml = isDark ? afterHtmlDark : afterHtmlLight;

  return (
    <div className="mx-auto w-full">
      <div className="group border-border relative w-full overflow-hidden rounded-xl border">
        <div className="relative grid gap-4 md:grid-cols-2 md:gap-0">
          <CodeWindow
            title={filename}
            codeClassName="text-xs p-2"
            code={badCode}
            codeHtml={beforeHtml}
          />
          <CodeWindow
            title={filename}
            codeClassName="text-xs p-2"
            code={goodCode}
            codeHtml={afterHtml}
          />
        </div>

        <div className="text-muted-foreground border-primary bg-landing-bg-dark absolute top-1/2 left-1/2 hidden h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border text-xs font-bold md:flex">
          VS
        </div>
      </div>
    </div>
  );
}
