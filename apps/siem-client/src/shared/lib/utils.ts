import clsx, { type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cx(...args: ClassValue[]) {
  return twMerge(clsx(...args));
}

export const focusInput = [
  "focus:ring-2",
  "focus:ring-blue-200 focus:dark:ring-blue-700/30",
  "focus:border-blue-500 focus:dark:border-blue-700",
];

export const focusRing = [
  "outline outline-offset-2 outline-0 focus-visible:outline-2",
  "focus-visible:outline-blue-500 dark:focus-visible:outline-blue-500",
];

export const hasErrorInput = [
  "ring-2",
  "ring-red-200 dark:ring-red-500/30",
  "border-red-500 dark:border-red-700",
];
