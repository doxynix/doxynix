"use client";

import { type ReactNode, useEffect, useId, useRef } from "react";
import { useTranslations } from "next-intl";

import { Input } from "@/shared/ui/core/input";
import { Label } from "@/shared/ui/core/label";

import { CopyButton } from "./copy-button";

export function phraseMatches(value: string, phrase: string): boolean {
  return value.trim().toLowerCase() === phrase.trim().toLowerCase();
}

type Props = {
  onValueChange: (value: string) => void;
  phrase: string;
  value: string;
};

export function ConfirmationField({ onValueChange, phrase, value }: Readonly<Props>) {
  const t = useTranslations("Common");
  const hintId = useId();
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const isValid = phraseMatches(value, phrase);

  useEffect(() => {
    const node = inputRef.current;
    node?.focus();
    node?.select();
  }, []);

  const styles = {
    phrase: () => (
      <span className="inline-flex bg-background rounded-xl px-1 items-center gap-1 align-middle">
        <code className="px-1.5 py-0.5 font-mono font-semibold text-foreground select-all">
          {phrase}
        </code>
        <CopyButton
          alwaysVisible={true}
          className="-my-1 size-5"
          tooltipText={t("copy")}
          value={phrase}
        />
      </span>
    ),
  } satisfies Record<string, (chunks: ReactNode) => ReactNode>;

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={inputId}>
        <p
          className="text-muted-foreground text-sm"
          id={hintId}
        >
          {t.rich("confirm_phrase_hint", styles)}
        </p>
      </Label>

      <Input
        aria-describedby={hintId}
        aria-invalid={value.length > 0 && !isValid}
        autoCapitalize="none"
        autoComplete="off"
        autoCorrect="off"
        id={inputId}
        onChange={(event) => onValueChange(event.target.value)}
        placeholder={phrase}
        ref={inputRef}
        spellCheck={false}
        value={value}
      />
    </div>
  );
}
