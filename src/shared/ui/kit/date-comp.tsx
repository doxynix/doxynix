"use client";

type Props = {
  isYear?: boolean;
  value?: Date | string;
};

export function DateComp({ isYear = false, value }: Readonly<Props>) {
  const targetDate = value ? new Date(value) : new Date();

  return (
    <span suppressHydrationWarning>
      {isYear ? targetDate.getFullYear() : targetDate.toLocaleDateString("en-US")}
    </span>
  );
}
