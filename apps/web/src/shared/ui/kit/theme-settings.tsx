"use client";

import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";

import { cn } from "@/shared/lib/cn";
import { useMounted } from "@/shared/lib/hooks/use-mounted";
import { Card, CardContent } from "@/shared/ui/core/card";
import { Input } from "@/shared/ui/core/input";
import { Label } from "@/shared/ui/core/label";

const CARDS = [
  { muted: 0, widths: ["w-3/5", "w-9/10", "w-7/10"] },
  { muted: 1, widths: ["w-7/10", "w-1/2", "w-[85%]"] },
  { muted: 2, widths: ["w-4/5", "w-[65%]", "w-[45%]"] },
  { muted: 0, widths: ["w-[55%]", "w-[85%]", "w-3/4"] },
] as const;

type Tone = "dark" | "light" | "system";
type WindowTone = Exclude<Tone, "system">;

function WindowMock({ tone }: Readonly<{ tone: WindowTone }>) {
  return (
    <div className={cn("flex h-full w-full", tone === "dark" ? "dark" : "light")}>
      <div className="flex w-[30%] flex-col gap-[3px] bg-sidebar p-[5px]">
        <div className="mb-0.5 flex items-center gap-[3px]">
          <div className="size-[5px] shrink-0 rounded-full bg-brand-ai" />
          <div className="h-[3px] w-3/5 rounded-full bg-border" />
        </div>
        <div className="flex h-[7px] items-center rounded-[2px] bg-surface-selected px-[3px]">
          <div className="h-[2.5px] w-3/4 rounded-full bg-muted-foreground" />
        </div>
        <div className="flex h-[7px] items-center px-[3px]">
          <div className="h-[2.5px] w-2/3 rounded-full bg-border" />
        </div>
        <div className="flex h-[7px] items-center px-[3px]">
          <div className="h-[2.5px] w-4/5 rounded-full bg-border" />
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-[5px] bg-background p-[5px]">
        <div className="h-[5px] w-[46%] rounded-full bg-foreground" />
        <div className="grid flex-1 grid-cols-2 gap-1">
          {CARDS.map(({ muted, widths }) => (
            <div
              className="flex flex-col gap-[2px] rounded-[2px] bg-card p-[3px] ring-1 ring-border ring-inset"
              key={widths.join()}
            >
              {widths.map((width, lineIndex) => (
                <div
                  className={cn(
                    "h-[2.5px] rounded-full",
                    width,
                    lineIndex === muted ? "bg-muted-foreground" : "bg-border",
                  )}
                  key={width}
                />
              ))}
            </div>
          ))}
        </div>
        <div className="h-[7px] w-[26%] rounded-[2px] bg-foreground" />
      </div>
    </div>
  );
}

function ThemePreview({ tone }: Readonly<{ tone: Tone }>) {
  if (tone === "system") {
    return (
      <div className="flex h-full w-full">
        <div className="w-1/2 overflow-hidden border-r">
          <WindowMock tone="light" />
        </div>
        <div className="w-1/2 overflow-hidden">
          <WindowMock tone="dark" />
        </div>
      </div>
    );
  }

  return <WindowMock tone={tone} />;
}

function ThemeOption({
  checked,
  disabled,
  label,
  onSelect,
  tone,
  value,
}: Readonly<{
  checked: boolean;
  disabled?: boolean;
  label: string;
  onSelect: () => void;
  tone: Tone;
  value: string;
}>) {
  const id = `theme-option-${value}`;

  return (
    <Label
      className={cn(
        "flex flex-1 cursor-pointer flex-col gap-2 rounded-xl border p-2 font-normal transition-standard",
        "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring/50",
        disabled && "cursor-not-allowed opacity-50",
        checked ? "border-primary bg-accent" : "border-input hover:bg-accent/50",
      )}
      htmlFor={id}
    >
      <Input
        checked={checked}
        className="sr-only"
        disabled={disabled}
        id={id}
        name="theme"
        onChange={onSelect}
        type="radio"
        value={value}
      />
      <div
        className={cn(
          "aspect-2/1 w-full overflow-hidden rounded-md ring-1 ring-inset",
          checked ? "ring-primary" : "ring-border",
        )}
      >
        <ThemePreview tone={tone} />
      </div>
      <span
        className={cn(
          "px-0.5 text-center text-sm",
          checked ? "font-semibold text-foreground" : "text-muted-foreground",
        )}
      >
        {label}
      </span>
    </Label>
  );
}

export function ThemeSettings() {
  const { forcedTheme, setTheme, theme } = useTheme();
  const tCommon = useTranslations("Common");
  const mounted = useMounted();

  const disabled = forcedTheme != null;
  const active = mounted ? (theme ?? "system") : undefined;

  return (
    <Card className="max-w-2xl">
      <CardContent>
        <div
          aria-label={tCommon("toggle_theme")}
          className="flex flex-col gap-3 sm:flex-row"
          role="radiogroup"
        >
          <ThemeOption
            checked={active === "light"}
            disabled={disabled}
            label={tCommon("theme_light")}
            onSelect={() => {
              setTheme("light");
            }}
            tone="light"
            value="light"
          />
          <ThemeOption
            checked={active === "dark"}
            disabled={disabled}
            label={tCommon("theme_dark")}
            onSelect={() => {
              setTheme("dark");
            }}
            tone="dark"
            value="dark"
          />
          <ThemeOption
            checked={active === "system"}
            disabled={disabled}
            label={tCommon("theme_system")}
            onSelect={() => {
              setTheme("system");
            }}
            tone="system"
            value="system"
          />
        </div>
      </CardContent>
    </Card>
  );
}
