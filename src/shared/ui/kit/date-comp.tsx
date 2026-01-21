"use client";

type Props = {
  isYear?: boolean;
  value?: string | Date;
};

export function DateComp({ isYear = false, value }: Props) {
  const targetDate = value ? new Date(value) : new Date();

  return (
    <span suppressHydrationWarning>
      {isYear ? targetDate.getFullYear() : targetDate.toLocaleDateString("ru-RU")}
    </span>
  );
}
